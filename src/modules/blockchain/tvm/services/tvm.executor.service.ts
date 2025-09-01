import { Injectable } from '@nestjs/common';

import { TronWeb } from 'tronweb';
import { erc20Abi } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { TvmTransactionError } from '../errors';
import { TronAddress } from '../types/address.types';
import { TvmClientUtils, TvmTracingUtils, TvmTransactionUtils } from '../utils';

import { TvmWalletManagerService, TvmWalletType } from './tvm-wallet-manager.service';

@Injectable()
export class TvmExecutorService extends BaseChainExecutor {
  constructor(
    private tvmConfigService: TvmConfigService,
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
          const destinationChainId = this.getChainId(intent.destination);
          const sourceChainId = intent.sourceChainId
            ? this.getChainId(intent.sourceChainId)
            : destinationChainId;

          // Get wallet
          const walletType = walletId || 'basic';
          const wallet = this.walletManager.createWallet(destinationChainId, walletType);
          const walletAddr = await wallet.getAddress();

          // TODO: Get claimant depending on the source
          const claimant = walletAddr;
          const claimantUA = AddressNormalizer.normalizeTvm(claimant as TronAddress);

          span.setAttribute('tvm.claimant_address', claimant);

          // Get prover information
          const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);
          if (!prover) {
            throw new Error('Prover not found.');
          }

          // TODO: Domain ID must be provided by the prover service
          const sourceDomainId = Number(sourceChainId);

          // Ensure the prover address has 0x prefix for consistency
          const proverFee = await prover.getFee(intent, claimantUA);
          const proofData = await prover.generateProof(intent);

          const proverAddr = AddressNormalizer.denormalizeToSvm(
            prover.getContractAddress(destinationChainId),
          );

          span.setAttributes({
            'tvm.prover_address': proverAddr,
            'tvm.prover_fee': proverFee.toString(),
            'tvm.proof_data_length': proofData.length,
          });

          // Calculate Portal hashes
          const sourceChainType = ChainTypeDetector.detect(sourceChainId);

          const rewardHash = PortalHashUtils.computeRewardHash(intent.reward, sourceChainType);

          const portalAddr = this.tvmConfigService.getPortalAddress(destinationChainId);
          span.setAttribute('tvm.portal_address', portalAddr);

          // First, approve all tokens
          const approvalTxIds: string[] = [];
          span.setAttribute('tvm.approval_count', intent.route.tokens.length);

          for (const { token: tokenUniversalAddr, amount } of intent.route.tokens) {
            const tokenAddress = AddressNormalizer.denormalizeToTvm(tokenUniversalAddr);

            span.addEvent('tvm.token.approving', {
              token_address: tokenAddress,
              amount: amount.toString(),
            });

            const txId = await wallet.triggerSmartContract(tokenAddress, erc20Abi, 'approve', [
              { type: 'address', value: portalAddr },
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
          const contract = wallet.tronWeb.contract(PortalAbi, portalAddr);

          // Structure route data for TronWeb contract call
          const routeData: Parameters<typeof contract.fulfillAndProve>[1] = [
            intent.route.salt,
            intent.route.deadline,
            AddressNormalizer.denormalizeToTvm(intent.route.portal),
            intent.route.nativeAmount,
            intent.route.tokens.map((t) => [AddressNormalizer.denormalizeToTvm(t.token), t.amount]),
            intent.route.calls.map((c) => [
              AddressNormalizer.denormalizeToTvm(c.target),
              c.data,
              c.value,
            ]),
          ];

          // Call Portal fulfillAndProve function with proof data
          const fulfillTxId = await contract
            .fulfillAndProve(
              intent.intentHash,
              routeData,
              rewardHash,
              claimantUA,
              proverAddr,
              sourceDomainId,
              proofData,
            )
            .send({ feeLimit: 300_000_000 });

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
   * Gets the native balance for an address on a specific chain
   * @param address - The address to check balance for
   * @param chainId - The chain ID to query
   * @returns The balance in wei
   */
  async getBalance(address: string, chainId: number): Promise<bigint> {
    return TvmTracingUtils.withSpan(
      this.otelService,
      'tvm.executor.getBalance',
      {
        chainId,
        address,
        operation: 'getBalance',
      },
      async (span) => {
        const client = this.createTronWebClient(chainId);
        const balance = await client.trx.getBalance(address);

        span.setAttribute('tvm.balance', balance.toString());
        return BigInt(balance);
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
