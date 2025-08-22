import { Injectable } from '@nestjs/common';

import { hashIntent, InboxAbi } from '@eco-foundation/routes-ts';
import * as api from '@opentelemetry/api';
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

import { TvmTransportService } from './tvm-transport.service';
import { TvmWalletManagerService, TvmWalletType } from './tvm-wallet-manager.service';

@Injectable()
export class TvmExecutorService extends BaseChainExecutor {
  constructor(
    private tvmConfigService: TvmConfigService,
    private transportService: TvmTransportService,
    private walletManager: TvmWalletManagerService,
    private proverService: ProverService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(TvmExecutorService.name);
  }

  async fulfill(intent: Intent, walletId?: TvmWalletType): Promise<ExecutionResult> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('tvm.executor.fulfill', {
        attributes: {
          'tvm.intent_id': intent.intentHash,
          'tvm.source_chain': intent.route.source.toString(),
          'tvm.destination_chain': intent.route.destination.toString(),
          'tvm.wallet_type': walletId || 'basic',
          'tvm.operation': 'fulfill',
        },
      });

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
      const claimantHexRaw = this.transportService.toHex(claimant);
      const claimantHex = claimantHexRaw.startsWith('0x') ? claimantHexRaw : '0x' + claimantHexRaw;

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
        const token = this.transportService.fromHex('41' + tokenHex.substring(2));

        span.addEvent('tvm.token.approving', {
          token_address: token,
          amount: amount.toString(),
        });

        const txId = await wallet.triggerSmartContract(token, erc20Abi, 'approve', [
          { type: 'address', value: this.transportService.toHex(inboxAddr) },
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

      const contract = await wallet.tronWeb.contract(InboxAbi, inboxAddr);
      // the first arg is the nested tuple as arrays in field order
      const fulfillTxId = await contract
        .fulfill(
          [
            intent.route.salt,
            intent.route.source,
            intent.route.destination,
            this.transportService.fromEvmHex(intent.route.inbox),
            intent.route.tokens.map((t) => [this.transportService.fromEvmHex(t.token), t.amount]),
            intent.route.calls.map((c) => [
              this.transportService.fromEvmHex(c.target),
              c.data,
              c.value,
            ]),
          ],
          rewardHash,
          this.transportService.toHex(claimant),
          intentHash,
          '410000000000000000000000000000000000000000',
        )
        .send({ feeLimit: 150e6 });

      span.setAttribute('tvm.transaction_hash', fulfillTxId);
      span.addEvent('tvm.fulfillment.submitted');

      // Wait for confirmation
      const isConfirmed = await this.waitForTransaction(fulfillTxId, destinationChainId);

      if (!isConfirmed) {
        span.addEvent('tvm.transaction.failed');
        span.setStatus({ code: api.SpanStatusCode.ERROR });

        return {
          success: false,
          error: 'Fulfillment transaction failed or timed out.',
        };
      }

      span.addEvent('tvm.transaction.confirmed');
      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }

      return {
        success: true,
        txHash: fulfillTxId,
      };
    } catch (error) {
      this.logger.error('TVM execution error:', error);
      if (!activeSpan) {
        span.recordException(error as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }
      return {
        success: false,
        error: error.message,
      };
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  async getBalance(address: string, chainId: number | string): Promise<bigint> {
    const client = this.transportService.getClient(chainId);
    const hexAddress = address.startsWith('T') ? this.transportService.toHex(address) : address;
    const balance = await client.trx.getBalance(hexAddress);
    return BigInt(balance);
  }

  async getWalletAddress(walletType: any, chainId: bigint | number | string): Promise<any> {
    const chainIdStr = typeof chainId === 'bigint' ? chainId.toString() : chainId;
    return this.walletManager.getWalletAddress(chainIdStr, walletType);
  }

  async isTransactionConfirmed(txHash: string, chainId: number | string): Promise<boolean> {
    const span = this.otelService.startSpan('tvm.executor.isTransactionConfirmed', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
        'tvm.transaction_hash': txHash,
        'tvm.operation': 'isTransactionConfirmed',
      },
    });

    try {
      const client = this.transportService.getClient(chainId);
      const txInfo = await client.trx.getTransactionInfo(txHash);

      const isConfirmed = txInfo && txInfo.blockNumber && txInfo.receipt?.result === 'SUCCESS';

      span.setAttribute('tvm.transaction_confirmed', isConfirmed);
      span.setStatus({ code: api.SpanStatusCode.OK });

      return isConfirmed;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      return false;
    } finally {
      span.end();
    }
  }

  private async waitForTransaction(
    txId: string,
    chainId: number | string,
    maxAttempts: number = 30,
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isTransactionConfirmed(txId, chainId)) {
        return true;
      }
      // Wait 2 seconds between checks
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return false;
  }

  private async waitForTransactions(txIds: string[], chainId: number | string): Promise<void> {
    await Promise.all(txIds.map((txId) => this.waitForTransaction(txId, chainId)));
  }

  private getChainId(chainId: bigint | number | string): number | string {
    if (typeof chainId === 'bigint') {
      // Check if it's a known TVM chain ID
      const chainIdNum = Number(chainId);
      if (chainIdNum === 728126428) {
        // 0x2b6653dc
        return 'tron-mainnet';
      }
      const chainIdStr = chainId.toString();
      if (chainIdStr === '1' || chainIdStr === 'tron-mainnet') {
        return 'tron-mainnet';
      } else if (chainIdStr === '2' || chainIdStr === 'tron-testnet') {
        return 'tron-testnet';
      }
      return chainIdNum;
    }
    return chainId;
  }
}
