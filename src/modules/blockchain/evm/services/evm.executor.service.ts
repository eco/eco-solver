import { Injectable } from '@nestjs/common';

import { hashIntent, InboxAbi } from '@eco-foundation/routes-ts';
import * as api from '@opentelemetry/api';
import { Address, encodeFunctionData, erc20Abi } from 'viem';

import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { EvmTransportService } from './evm-transport.service';
import { EvmWalletManager, WalletType } from './evm-wallet-manager.service';

@Injectable()
export class EvmExecutorService extends BaseChainExecutor {
  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private walletManager: EvmWalletManager,
    private proverService: ProverService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(EvmExecutorService.name);
  }

  async fulfill(intent: Intent, walletId: WalletType): Promise<ExecutionResult> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('evm.executor.fulfill', {
        attributes: {
          'evm.intent_id': intent.intentHash,
          'evm.source_chain': intent.route.source.toString(),
          'evm.destination_chain': intent.route.destination.toString(),
          'evm.wallet_type': walletId,
          'evm.operation': 'fulfill',
        },
      });

    try {
      // Get the destination chain ID from the intent
      const sourceChainId = Number(intent.route.source);
      const destinationChainId = Number(intent.route.destination);

      // Map walletId to wallet type - for backward compatibility
      const wallet = this.walletManager.getWallet(walletId, destinationChainId);

      const claimant = await wallet.getAddress();
      span.setAttribute('evm.claimant_address', claimant);

      const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);
      if (!prover) {
        throw new Error('Prover not found.');
      }

      const proverAddr = prover.getContractAddress(destinationChainId);
      const proverFee = await prover.getFee(intent, claimant);
      const proverMessageData = await prover.getMessageData(intent);

      span.setAttributes({
        'evm.prover_address': proverAddr,
        'evm.prover_fee': proverFee.toString(),
      });

      const { intentHash, rewardHash } = hashIntent(intent);

      const inboxAddr = this.evmConfigService.getInboxAddress(destinationChainId);
      span.setAttribute('evm.inbox_address', inboxAddr);

      const approvalTxs = intent.route.tokens.map(({ token, amount }) => ({
        to: token,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [inboxAddr, amount],
        }),
      }));

      span.setAttribute('evm.approval_count', approvalTxs.length);

      const fulfillTx = {
        to: inboxAddr,
        value: proverFee,
        data: encodeFunctionData({
          abi: InboxAbi,
          functionName: 'fulfillAndProve',
          args: [intent.route, rewardHash, claimant, intentHash, proverAddr, proverMessageData],
        }),
      };

      span.addEvent('evm.transaction.submitting', {
        transaction_count: approvalTxs.length + 1,
      });

      const [hash] = await wallet.writeContracts(
        [...approvalTxs, fulfillTx],
        { value: 0n }, // EOA doesn't send ETH, prover fee is paid by the Kernel wallet
      );

      span.setAttribute('evm.transaction_hash', hash);
      span.addEvent('evm.transaction.submitted');

      const publicClient = this.transportService.getPublicClient(destinationChainId);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 2,
      });

      if (receipt.status === 'reverted') {
        span.addEvent('evm.transaction.reverted');
        span.setStatus({ code: api.SpanStatusCode.ERROR });

        return {
          success: false,
          error: 'Fulfillment transaction reverted.',
        };
      }

      span.addEvent('evm.transaction.confirmed');
      if (!activeSpan) {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }

      return {
        success: true,
        txHash: hash,
      };
    } catch (error) {
      this.logger.error('EVM execution error:', error);
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

  async getBalance(address: string, chainId: number): Promise<bigint> {
    const publicClient = this.transportService.getPublicClient(chainId);
    return publicClient.getBalance({ address: address as Address });
  }

  async getWalletAddress(walletType: WalletType, chainId: bigint | number): Promise<Address> {
    return this.walletManager.getWalletAddress(walletType, Number(chainId));
  }

  async isTransactionConfirmed(txHash: string, chainId: number): Promise<boolean> {
    try {
      const publicClient = this.transportService.getPublicClient(chainId);
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as Address,
      });
      return receipt.status === 'success';
    } catch {
      return false;
    }
  }
}
