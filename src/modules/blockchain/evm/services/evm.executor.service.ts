import { Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Address, encodeFunctionData, erc20Abi, Hex, pad } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';
import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { toEVMIntent } from '@/common/utils/intent-converter';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';
import { BatchWithdrawData } from '@/modules/withdrawal/interfaces/withdrawal-job.interface';

import { EvmTransportService } from './evm-transport.service';
import { EvmWalletManager, WalletType } from './evm-wallet-manager.service';

@Injectable()
export class EvmExecutorService extends BaseChainExecutor {
  constructor(
    private evmConfigService: EvmConfigService,
    private blockchainConfigService: BlockchainConfigService,
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

      // Get claimant from source chain configuration
      const configuredClaimant = this.blockchainConfigService.getClaimant(sourceChainId);
      const claimant = AddressNormalizer.denormalizeToEvm(configuredClaimant);
      const normalizedClaimant = configuredClaimant;
      span.setAttribute('evm.claimant_address', claimant);

      // Get Portal address for a destination chain from config
      const portalAddressUA = this.evmConfigService.getPortalAddress(destinationChainId);
      if (!portalAddressUA) {
        throw new Error(`No Portal address configured for chain ${destinationChainId}`);
      }

      const portalAddress = AddressNormalizer.denormalizeToEvm(portalAddressUA);

      // Denormalize prover address for use with ProverService
      const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);
      if (!prover) {
        throw new Error('Prover not found.');
      }

      // TODO: Domain ID must be provided by the prover service
      const sourceDomainId = BigInt(sourceChainId);

      const sourceChainType = ChainTypeDetector.detect(sourceChainId);
      const rewardHash = PortalHashUtils.computeRewardHash(intent.reward, sourceChainType);

      const proverContract = prover.getContractAddress(destinationChainId);
      if (!proverContract) {
        throw new Error(`No prover contract address found for chain ${destinationChainId}`);
      }
      const proverAddr = AddressNormalizer.denormalizeToEvm(proverContract);
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
      this.logger.error('EVM execution error:', toError(error));
      if (!activeSpan) {
        span.recordException(toError(error));
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }
      return {
        success: false,
        error: getErrorMessage(error),
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
        hash: txHash as Hex,
      });
      return receipt.status === 'success';
    } catch {
      return false;
    }
  }

  async executeBatchWithdraw(
    chainId: bigint,
    withdrawalData: BatchWithdrawData,
    walletId?: string,
  ): Promise<string> {
    const span = this.otelService.startSpan('evm.executor.batchWithdraw', {
      attributes: {
        'evm.chain_id': chainId.toString(),
        'evm.wallet_type': walletId || 'basic',
        'evm.intent_count': withdrawalData.destinations.length,
        'evm.operation': 'batchWithdraw',
      },
    });

    try {
      const chainIdNum = Number(chainId);

      // Get the wallet for this chain
      const walletType = (walletId as WalletType) || 'basic';
      const wallet = this.walletManager.getWallet(walletType, chainIdNum);
      const walletAddress = await wallet.getAddress();

      span.setAttribute('evm.wallet_address', walletAddress);

      // Get Portal address for the source chain from config
      const portalAddressUA = this.evmConfigService.getPortalAddress(chainIdNum);
      if (!portalAddressUA) {
        throw new Error(`No Portal address configured for chain ${chainId}`);
      }
      const portalAddress = AddressNormalizer.denormalizeToEvm(portalAddressUA);

      span.setAttribute('portal.address', portalAddress);

      // Convert UniversalAddresses to EVM addresses and prepare the data
      const destinations = withdrawalData.destinations.map((d) => d);
      const routeHashes = withdrawalData.routeHashes.map((h) => h as Hex);
      const rewards = withdrawalData.rewards.map((r) => ({
        deadline: r.deadline,
        creator: AddressNormalizer.denormalizeToEvm(r.creator as UniversalAddress),
        prover: AddressNormalizer.denormalizeToEvm(r.prover as UniversalAddress),
        nativeAmount: r.nativeAmount,
        tokens: r.tokens.map((t) => ({
          token: AddressNormalizer.denormalizeToEvm(t.token as UniversalAddress),
          amount: t.amount,
        })),
      }));

      // Encode the batchWithdraw function call
      const data = encodeFunctionData({
        abi: PortalAbi,
        functionName: 'batchWithdraw',
        args: [destinations, routeHashes, rewards],
      });

      this.logger.log(
        `Executing batchWithdraw on chain ${chainId} for ${withdrawalData.destinations.length} intents`,
      );

      // Execute the transaction using the encoded data
      const txHash = await wallet.writeContract({
        to: portalAddress,
        data,
      });

      span.setAttributes({
        'evm.tx_hash': txHash,
        'evm.status': 'success',
      });

      this.logger.log(`Successfully executed batchWithdraw on chain ${chainId}. TxHash: ${txHash}`);

      span.setStatus({ code: api.SpanStatusCode.OK });
      return txHash;
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      this.logger.error(
        `Failed to execute batchWithdraw on chain ${chainId}: ${getErrorMessage(error)}`,
        toError(error),
      );
      throw error;
    } finally {
      span.end();
    }
  }
}
