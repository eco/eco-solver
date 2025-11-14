import { Injectable, Optional } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Address, encodeFunctionData, erc20Abi, Hex, pad, TransactionReceipt } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';
import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { toEvmRoute } from '@/common/utils/intent-converter';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';
import { replaceRelayerContext } from '@/modules/rhinestone/utils/replace-relayer-context';
import { RhinestoneWebsocketService } from '@/modules/rhinestone/services/rhinestone-websocket.service';
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
    @Optional() private rhinestoneWebsocketService?: RhinestoneWebsocketService,
  ) {
    super();
    this.logger.setContext(EvmExecutorService.name);
  }

  async fulfill(intent: Intent, walletId: WalletType): Promise<ExecutionResult> {
    return this.otelService.tracer.startActiveSpan(
      'evm.executor.fulfill',
      {
        attributes: {
          'evm.intent_hash': intent.intentHash,
          'evm.source_chain': intent.sourceChainId?.toString(),
          'evm.destination_chain': intent.destination.toString(),
          'evm.wallet_type': walletId,
          'evm.operation': 'fulfill',
        },
      },
      async (span) => {
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

          const rewardHash = PortalHashUtils.computeRewardHash(intent.reward, intent.sourceChainId);

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

          const evmRoute = toEvmRoute(intent.route);

          const fulfillTx = {
            to: portalAddress,
            value: proverFee,
            data: encodeFunctionData({
              abi: portalAbi,
              functionName: 'fulfillAndProve',
              args: [
                intent.intentHash,
                evmRoute,
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

          const [hash] = await wallet.writeContracts([...approvalTxs, fulfillTx]);

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
          span.setStatus({ code: api.SpanStatusCode.OK });

          return {
            success: true,
            txHash: hash,
          };
        } catch (error) {
          this.logger.error('EVM execution error:', toError(error));
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          return {
            success: false,
            error: getErrorMessage(error),
          };
        } finally {
          span.end();
        }
      },
    );
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
    walletId = this.evmConfigService.defaultWallet,
  ): Promise<string> {
    return this.otelService.tracer.startActiveSpan(
      'evm.executor.batchWithdraw',
      {
        attributes: {
          'evm.chain_id': chainId.toString(),
          'evm.wallet_type': walletId,
          'evm.intent_count': withdrawalData.destinations.length,
          'evm.operation': 'batchWithdraw',
        },
      },
      async (span) => {
        try {
          const chainIdNum = Number(chainId);

          // Get the wallet for this chain
          const walletType = walletId as WalletType;
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
            abi: portalAbi,
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

          this.logger.log(
            `Successfully executed batchWithdraw on chain ${chainId}. TxHash: ${txHash}`,
          );

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
      },
    );
  }

  /**
   * Execute CLAIM phase for Rhinestone
   * Funds the intent on the source chain using pre-encoded calldata
   */
  async executeRhinestoneClaim(
    chainId: number,
    routerAddress: Address,
    claimData: Hex,
    claimValue: bigint,
    walletId: WalletType,
  ): Promise<Hex> {
    return this.otelService.tracer.startActiveSpan(
      'evm.rhinestone.claim',
      {
        attributes: {
          'evm.operation': 'rhinestone_claim',
          'evm.chain_id': chainId.toString(),
          'evm.claim_value': claimValue.toString(),
          'evm.router_address': routerAddress,
        },
      },
      async (span) => {
        try {
          const wallet = this.walletManager.getWallet(walletId, chainId);
          const solverAddress = await wallet.getAddress();

          // Patch relayerContext to solver address
          const patchedData = replaceRelayerContext(claimData, solverAddress);

          // Send transaction using writeContract
          const txHash = await wallet.writeContract({
            to: routerAddress as Address,
            data: patchedData,
            value: claimValue,
          });

          span.setAttribute('evm.tx_hash', txHash);

          // Wait for confirmation
          const publicClient = this.transportService.getPublicClient(chainId);
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
          });

          if (receipt.status !== 'success') {
            throw new Error(`CLAIM transaction reverted: ${txHash}`);
          }

          this.logger.log(`Rhinestone CLAIM complete: ${txHash}`);
          span.setStatus({ code: api.SpanStatusCode.OK });
          return txHash;
        } catch (error) {
          this.logger.error('Rhinestone CLAIM error:', toError(error));
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Execute FILL phase for Rhinestone
   * Fulfills the intent on destination chain using pre-encoded calldata
   */
  async executeRhinestoneFill(
    chainId: number,
    intent: Intent,
    routerAddress: Address,
    fillData: Hex,
    fillValue: bigint,
    walletId: WalletType,
    messageId: string,
  ): Promise<Hex> {
    return this.otelService.tracer.startActiveSpan(
      'evm.rhinestone.fill',
      {
        attributes: {
          'evm.operation': 'rhinestone_fill',
          'evm.chain_id': chainId.toString(),
          'evm.intent_hash': intent.intentHash,
          'evm.fill_value': fillValue.toString(),
          'evm.router_address': routerAddress,
        },
      },
      async (span) => {
        try {
          const wallet = this.walletManager.getWallet(walletId, chainId);
          const solverAddress = await wallet.getAddress();

          // Approve tokens for
          const approvalTxs = intent.route.tokens.map(({ token, amount }) => ({
            to: AddressNormalizer.denormalizeToEvm(token),
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [routerAddress, amount],
            }),
          }));

          // Execute approvals if needed
          if (approvalTxs.length > 0) {
            await wallet.writeContracts(approvalTxs, { value: 0n });
            this.logger.log(`Approved ${approvalTxs.length} tokens for Rhinestone FILL`);
          }

          // Patch relayerContext
          const patchedData = replaceRelayerContext(fillData, solverAddress);

          // Send transaction using writeContract
          const txHash = await wallet.writeContract({
            to: routerAddress as Address,
            data: patchedData,
            value: fillValue,
          });

          span.setAttribute('evm.tx_hash', txHash);

          // Send preconfirmation IMMEDIATELY after tx submission (don't wait for mining)
          if (this.rhinestoneWebsocketService) {
            try {
              await this.rhinestoneWebsocketService.sendActionStatus(messageId, {
                type: 'Success',
                preconfirmation: { txId: txHash },
              });
              this.logger.log(`Sent preconfirmation for FILL tx: ${txHash}`);
              span.addEvent('rhinestone.preconfirmation.sent', { txHash });
            } catch (error) {
              // Log error but don't fail execution
              this.logger.warn(
                `Failed to send preconfirmation: ${error instanceof Error ? error.message : String(error)}`,
              );
              span.addEvent('rhinestone.preconfirmation.failed', {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Wait for confirmation
          const publicClient = this.transportService.getPublicClient(chainId);
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
          });

          if (receipt.status !== 'success') {
            throw new Error(`FILL transaction reverted: ${txHash}`);
          }

          this.logger.log(`Rhinestone FILL complete: ${txHash}`);
          span.setStatus({ code: api.SpanStatusCode.OK });
          return txHash;
        } catch (error) {
          this.logger.error('Rhinestone FILL error:', toError(error));
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Execute PROVE phase for Rhinestone
   * Submits proof to Portal contract via Hyperlane
   */
  async executeRhinestoneProve(
    chainId: number,
    intent: Intent,
    walletId: WalletType,
  ): Promise<{ txHash: Hex; receipt: TransactionReceipt }> {
    return this.otelService.tracer.startActiveSpan(
      'evm.rhinestone.prove',
      {
        attributes: {
          'evm.operation': 'rhinestone_prove',
          'evm.chain_id': chainId.toString(),
          'evm.intent_hash': intent.intentHash,
        },
      },
      async (span) => {
        try {
          const wallet = this.walletManager.getWallet(walletId, chainId);

          // Get source chain info for prover
          const sourceChainId = Number(intent.sourceChainId);

          // Get prover
          const prover = this.proverService.getProver(sourceChainId, intent.reward.prover);
          if (!prover) {
            throw new Error('Prover not found for Rhinestone PROVE');
          }

          // Calculate prover fee
          const configuredClaimant = this.blockchainConfigService.getClaimant(sourceChainId);
          const proverFee = await prover.getFee(intent, configuredClaimant);

          // Generate proof
          const proofData = await prover.generateProof(intent);

          // Get prover contract address
          const proverContract = prover.getContractAddress(chainId);
          if (!proverContract) {
            throw new Error(`No prover contract address found for chain ${chainId}`);
          }
          const proverAddr = AddressNormalizer.denormalizeToEvm(proverContract);

          // Get Portal address
          const portalAddressUA = this.evmConfigService.getPortalAddress(chainId);
          if (!portalAddressUA) {
            throw new Error(`No Portal address configured for chain ${chainId}`);
          }
          const portalAddress = AddressNormalizer.denormalizeToEvm(portalAddressUA);

          // Call Portal.prove()
          const proveTx = {
            to: portalAddress,
            data: encodeFunctionData({
              abi: portalAbi,
              functionName: 'prove',
              args: [proverAddr, BigInt(sourceChainId), [intent.intentHash as Hex], proofData],
            }),
            value: proverFee,
          };

          const txHash = await wallet.writeContract(proveTx);

          span.setAttribute('evm.tx_hash', txHash);
          span.setAttribute('evm.prover_address', proverAddr);
          span.setAttribute('evm.prover_fee', proverFee.toString());

          // Wait for confirmation
          const publicClient = this.transportService.getPublicClient(chainId);
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
          });

          if (receipt.status !== 'success') {
            throw new Error(`PROVE transaction reverted: ${txHash}`);
          }

          this.logger.log(`Rhinestone PROVE complete: ${txHash}`);
          span.setStatus({ code: api.SpanStatusCode.OK });
          return { txHash, receipt };
        } catch (error) {
          this.logger.error('Rhinestone PROVE error:', toError(error));
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
