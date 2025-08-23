import { Injectable } from '@nestjs/common';

import { hashIntent, InboxAbi } from '@eco-foundation/routes-ts';
import { TronWeb } from 'tronweb';
import { erc20Abi } from 'viem';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { TvmTransactionError } from '../errors';
import { TvmClientUtils, TvmTracingUtils, TvmTransactionUtils } from '../utils';

import { TvmUtilsService } from './tvm-utils.service';
import { TvmWalletManagerService, TvmWalletType } from './tvm-wallet-manager.service';

@Injectable()
export class TvmExecutorService extends BaseChainExecutor {
  constructor(
    private tvmConfigService: TvmConfigService,
    private utilsService: TvmUtilsService,
    private walletManager: TvmWalletManagerService,
    private proverService: ProverService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(TvmExecutorService.name);
  }

  /**
   * Fulfills an intent on the TVM blockchain
   * @param intent - The intent to fulfill
   * @param walletId - Optional wallet type to use for execution
   * @returns Execution result with success status and transaction hash if successful
   */
  async fulfill(intent: Intent, walletId?: TvmWalletType): Promise<ExecutionResult> {
    return TvmTracingUtils.withSpan(
      this.otelService,
      'tvm.executor.fulfill',
      {
        ...TvmTracingUtils.createIntentAttributes(intent),
        wallet_type: walletId || 'basic',
        operation: 'fulfill',
      },
      async (span) => {
        try {
          // Get the destination chain ID from the intent
          const sourceChainId = this.getChainId(intent.route.source);
          const destinationChainId = this.getChainId(intent.route.destination);

          // Get wallet
          const walletType = walletId || 'basic';
          const wallet = this.walletManager.createWallet(destinationChainId, walletType);

          const claimant = await wallet.getAddress();
          span.setAttribute('tvm.claimant_address', claimant);

          // Convert to hex with a 0x prefix for compatibility with other parts of the system
          const claimantHexRaw = this.utilsService.toHex(claimant);
          const claimantHex = claimantHexRaw.startsWith('0x')
            ? claimantHexRaw
            : '0x' + claimantHexRaw;

          // Get prover information
          const sourceChainIdNum = typeof sourceChainId === 'string' ? 0 : sourceChainId; // Use 0 for non-numeric chains
          const prover = this.proverService.getProver(sourceChainIdNum, intent.reward.prover);
          if (!prover) {
            throw new Error('Prover not found.');
          }

          const destChainIdNum = typeof destinationChainId === 'string' ? 0 : destinationChainId;
          const proverAddrRaw = prover.getContractAddress(destChainIdNum);
          // Ensure prover address has 0x prefix for consistency
          const proverAddr = proverAddrRaw.startsWith('0x') ? proverAddrRaw : '0x' + proverAddrRaw;
          const proverFee = await prover.getFee(intent, claimantHex as any);

          span.setAttributes({
            'tvm.prover_address': proverAddr,
            'tvm.prover_fee': proverFee.toString(),
          });

          const { intentHash, rewardHash } = hashIntent(intent);

          const inboxAddr = this.tvmConfigService.getInboxAddress(destinationChainId);
          span.setAttribute('tvm.inbox_address', inboxAddr);

          // First, approve all tokens
          const approvalTxIds: string[] = [];
          span.setAttribute('tvm.approval_count', intent.route.tokens.length);

          for (const { token: tokenHex, amount } of intent.route.tokens) {
            const token = this.utilsService.fromEvmHex(tokenHex);

            span.addEvent('tvm.token.approving', {
              token_address: token,
              amount: amount.toString(),
            });

            const txId = await wallet.triggerSmartContract(token, erc20Abi, 'approve', [
              { type: 'address', value: this.utilsService.toHex(inboxAddr) },
              { type: 'uint256', value: amount.toString() },
            ]);

            approvalTxIds.push(txId);
            span.addEvent('tvm.token.approved', { transaction_id: txId });
          }

          // Wait for all approvals to be confirmed
          if (approvalTxIds.length > 0) {
            await this.waitForTransactions(approvalTxIds, destinationChainId);
          }

          span.addEvent('tvm.fulfillment.submitting');

          // TODO: Approvals and fulfillment must be executed inside a single transaction

          const contract = wallet.tronWeb.contract(InboxAbi, inboxAddr);
          // the first arg is the nested tuple as arrays in field order
          const fulfillTxId = await contract
            .fulfill(
              [
                intent.route.salt,
                intent.route.source,
                intent.route.destination,
                this.utilsService.fromEvmHex(intent.route.inbox),
                intent.route.tokens.map((t) => [this.utilsService.fromEvmHex(t.token), t.amount]),
                intent.route.calls.map((c) => [
                  this.utilsService.fromEvmHex(c.target),
                  c.data,
                  c.value,
                ]),
              ],
              rewardHash,
              this.utilsService.toHex(claimant),
              intentHash,
              '410000000000000000000000000000000000000000', // TODO: Move to configuration
            )
            .send();

          span.setAttribute('tvm.transaction_hash', fulfillTxId);
          span.addEvent('tvm.fulfillment.submitted');

          // Wait for confirmation
          const isConfirmed = await this.waitForTransaction(fulfillTxId, destinationChainId);

          if (!isConfirmed) {
            span.addEvent('tvm.transaction.failed');
            throw new TvmTransactionError(
              'Fulfillment transaction failed or timed out.',
              fulfillTxId,
            );
          }

          span.addEvent('tvm.transaction.confirmed');

          return {
            success: true,
            txHash: fulfillTxId,
          };
        } catch (error) {
          this.logger.error('TVM execution error:', error);
          return {
            success: false,
            error: error.message,
          };
        }
      },
    );
  }

  /**
   * Gets the native token balance for an address
   * @param address - The address to check (base58 or hex format)
   * @param chainId - The chain ID to query
   * @returns The balance in SUN (smallest unit)
   */
  async getBalance(address: string, chainId: number | string): Promise<bigint> {
    const client = this.createTronWebClient(chainId);
    const hexAddress = address.startsWith('T') ? this.utilsService.toHex(address) : address;
    const balance = await client.trx.getBalance(hexAddress);
    return BigInt(balance);
  }

  /**
   * Gets the wallet address for a specific wallet type
   * @param walletType - The type of wallet to get address for
   * @param chainId - The chain ID
   * @returns The wallet address
   */
  async getWalletAddress(walletType: any, chainId: bigint | number | string): Promise<any> {
    const chainIdStr = typeof chainId === 'bigint' ? chainId.toString() : chainId;
    return this.walletManager.getWalletAddress(chainIdStr, walletType);
  }

  /**
   * Checks if a transaction is confirmed on the blockchain
   * @param txHash - The transaction hash to check
   * @param chainId - The chain ID to query
   * @returns True if transaction is confirmed, false otherwise
   */
  async isTransactionConfirmed(txHash: string, chainId: number | string): Promise<boolean> {
    return TvmTracingUtils.withSpan(
      this.otelService,
      'tvm.executor.isTransactionConfirmed',
      {
        chainId,
        transactionHash: txHash,
        operation: 'isTransactionConfirmed',
      },
      async (span) => {
        const client = this.createTronWebClient(chainId);
        const txInfo = await client.trx.getTransactionInfo(txHash);

        const isConfirmed = txInfo && txInfo.blockNumber && txInfo.receipt?.result === 'SUCCESS';

        span.setAttribute('tvm.transaction_confirmed', isConfirmed);
        return isConfirmed;
      },
    );
  }

  /**
   * Creates a TronWeb instance for the given chain
   * @param chainId - The chain ID to create client for
   * @returns TronWeb instance
   */
  private createTronWebClient(chainId: number | string): TronWeb {
    const network = this.tvmConfigService.getChain(chainId);
    return TvmClientUtils.createClient(network);
  }

  private async waitForTransaction(
    txId: string,
    chainId: number | string,
    maxAttempts?: number,
  ): Promise<boolean> {
    const settings = this.tvmConfigService.getTransactionSettings();
    const client = this.createTronWebClient(chainId);

    return TvmTransactionUtils.waitForTransaction(
      client,
      txId,
      {
        ...settings,
        maxTransactionAttempts: maxAttempts ?? settings.maxTransactionAttempts,
      },
      this.logger,
    );
  }

  private async waitForTransactions(txIds: string[], chainId: number | string): Promise<void> {
    const settings = this.tvmConfigService.getTransactionSettings();
    const client = this.createTronWebClient(chainId);

    return TvmTransactionUtils.waitForTransactions(client, txIds, settings, this.logger);
  }

  private getChainId(chainId: bigint | number | string): number | string {
    if (typeof chainId === 'bigint') {
      return Number(chainId);
    }
    return chainId;
  }
}
