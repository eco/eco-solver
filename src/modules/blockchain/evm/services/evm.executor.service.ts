import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Address, encodeFunctionData, erc20Abi, pad } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { toEVMIntent } from '@/common/utils/intent-converter';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
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
          'evm.source_chain': intent.sourceChainId?.toString(),
          'evm.destination_chain': intent.destination.toString(),
          'evm.wallet_type': walletId,
          'evm.operation': 'fulfill',
        },
      });

    try {
      // Get the chain IDs from the intent
      const sourceChainId = Number(intent.sourceChainId);
      const destinationChainId = Number(intent.destination);

      // Map walletId to wallet type - for backward compatibility
      const wallet = this.walletManager.getWallet(walletId, destinationChainId);

      // TODO: Claimant must be set depending on the source chain
      const claimant = await wallet.getAddress();
      const normalizedClaimant = AddressNormalizer.normalizeEvm(claimant);
      span.setAttribute('evm.claimant_address', claimant);

      // Get Portal address for a destination chain from config
      const portalAddress = this.evmConfigService.getPortalAddress(destinationChainId) as Address;
      if (!portalAddress) {
        throw new Error(`No Portal address configured for chain ${destinationChainId}`);
      }

      // Denormalize prover address for use with ProverService
      const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);
      if (!prover) {
        throw new Error('Prover not found.');
      }

      // TODO: Domain ID must be provided by the prover service
      const sourceDomainId = BigInt(sourceChainId);

      const sourceChainType = ChainTypeDetector.detect(sourceChainId);
      const rewardHash = PortalHashUtils.computeRewardHash(intent.reward, sourceChainType);

      const proverAddr = AddressNormalizer.denormalizeToEvm(
        prover.getContractAddress(destinationChainId),
      );
      const proverFee = await prover.getFee(intent, normalizedClaimant);
      const proofData = await prover.generateProof(intent);

      span.setAttributes({
        'evm.prover_address': proverAddr,
        'evm.prover_fee': proverFee.toString(),
        'portal.address': portalAddress,
        'evm.proof_data_length': proofData.length,
      });

      const approvalTxs = intent.route.tokens.map(({ token, amount }) => ({
        to: AddressNormalizer.denormalizeToEvm(token),
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [portalAddress, amount],
        }),
      }));

      span.setAttribute('evm.approval_count', approvalTxs.length);

      const evmIntent = toEVMIntent(intent);

      const fulfillTx = {
        to: portalAddress,
        value: proverFee,
        data: encodeFunctionData({
          abi: PortalAbi,
          functionName: 'fulfillAndProve',
          args: [
            intent.intentHash,
            evmIntent.route,
            rewardHash,
            pad(claimant),
            proverAddr,
            sourceDomainId,
            proofData,
          ],
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

  async getWalletAddress(
    walletType: WalletType,
    chainId: bigint | number,
  ): Promise<UniversalAddress> {
    return AddressNormalizer.normalizeEvm(
      await this.walletManager.getWalletAddress(walletType, Number(chainId)),
    );
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
