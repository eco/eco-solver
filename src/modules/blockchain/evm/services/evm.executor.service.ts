import { Injectable, Logger } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Address, encodeFunctionData, erc20Abi, Hex, pad } from 'viem';

import { permit3Abi } from '@/common/abis/permit3.abi';
import { portalAbi } from '@/common/abis/portal.abi';
import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { toEvmRoute } from '@/common/utils/intent-converter';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';
import { BatchWithdrawData } from '@/modules/withdrawal/interfaces/withdrawal-job.interface';

import { FundForParams, Permit3Params } from '../../interfaces/executor-params.interface';

import { EvmTransportService } from './evm-transport.service';
import { EvmWalletManager, WalletType } from './evm-wallet-manager.service';

@Injectable()
export class EvmExecutorService extends BaseChainExecutor {
  private ecoLogger = new Logger(EvmExecutorService.name);

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

          const [hash] = await wallet.writeContracts([...approvalTxs, fulfillTx], {
            value: 0n, // EOA doesn't send ETH, prover fee is paid by the Kernel wallet
          });

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
   * Execute permit3 transaction for cross-chain token approvals
   * @param params Permit3 parameters
   * @returns Transaction hash
   */
  async permit3(params: Permit3Params, walletId: WalletType): Promise<Hex> {
    return this.otelService.tracer.startActiveSpan(
      'evm.executor.permit3',
      {
        attributes: {
          'evm.chain_id': params.chainId.toString(),
          'evm.wallet_type': walletId,
          'evm.permit_count': params.permits.length,
          'evm.operation': 'permit3',
        },
      },
      async (span) => {
        try {
          // Build the permit3 call using the helper
          const call = this.buildPermit3Call(params);

          // Get wallet for this chain
          const wallet = this.walletManager.getWallet(walletId, params.chainId);

          this.logger.log(
            `Executing permit3 on chain ${params.chainId} with ${params.permits.length} permits`,
          );

          span.setAttribute('evm.permit_contract', call.to);

          // Execute the transaction
          const txHash = await wallet.writeContract(call);

          span.setAttributes({
            'evm.tx_hash': txHash,
            'evm.status': 'success',
          });

          this.logger.log(
            `Successfully executed permit3 on chain ${params.chainId}. TxHash: ${txHash}`,
          );

          span.setStatus({ code: api.SpanStatusCode.OK });
          return txHash;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          this.logger.error(
            `Failed to execute permit3 on chain ${params.chainId}: ${getErrorMessage(error)}`,
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
   * Execute fundFor transaction to fund an intent on behalf of a user
   * @param params FundFor parameters
   * @returns Transaction hash
   */
  async fundFor(params: FundForParams, walletId: WalletType): Promise<Hex> {
    return this.otelService.tracer.startActiveSpan(
      'evm.executor.fundFor',
      {
        attributes: {
          'evm.chain_id': params.chainId.toString(),
          'evm.destination_chain': params.destination.toString(),
          'evm.wallet_type': walletId,
          'evm.allow_partial': params.allowPartial,
          'evm.operation': 'fundFor',
        },
      },
      async (span) => {
        try {
          this.ecoLogger.log(
            EcoLogMessage.fromDefault({
              message: `fundFor: entry`,
              properties: {
                chainId: params.chainId,
                destination: params.destination,
                routeHash: params.routeHash,
                allowPartial: params.allowPartial,
                funder: params.funder,
                permitContract: params.permitContract,
                walletType: walletId,
              },
            }),
          );

          // Build the fundFor call using the helper
          const call = this.buildFundForCall(params);

          // Get wallet for this chain
          const wallet = this.walletManager.getWallet(walletId, params.chainId);

          span.setAttribute('portal.address', call.to);

          this.ecoLogger.log(
            EcoLogMessage.fromDefault({
              message: `fundFor: wallet.writeContract`,
              properties: {
                to: call.to,
                data: call.data,
              },
            }),
          );

          this.logger.log(
            `Executing fundFor on chain ${params.chainId} for destination ${params.destination}`,
          );

          // Execute the transaction
          const txHash = await wallet.writeContract(call);

          this.ecoLogger.log(
            EcoLogMessage.fromDefault({
              message: `fundFor: txHash`,
              properties: {
                txHash,
              },
            }),
          );

          span.setAttributes({
            'evm.tx_hash': txHash,
            'evm.status': 'success',
          });

          this.logger.log(
            `Successfully executed fundFor on chain ${params.chainId}. TxHash: ${txHash}`,
          );

          span.setStatus({ code: api.SpanStatusCode.OK });
          return txHash;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          this.logger.error(
            `Failed to execute fundFor on chain ${params.chainId}: ${getErrorMessage(error)}`,
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
   * Execute a permit3 transaction followed by multiple fundFor transactions in a single atomic batch
   * Uses multicall3 for atomic execution - all calls succeed or all fail
   * @param permit3Params Permit3 parameters
   * @param fundForCalls Array of fundFor parameters for multiple intents
   * @returns Transaction hash of the batched transaction
   */
  async fundForWithPermit3(
    permit3Params: Permit3Params,
    fundForCalls: FundForParams[],
    walletId: WalletType,
  ): Promise<Hex> {
    const chainId = permit3Params.chainId;

    return this.otelService.tracer.startActiveSpan(
      'evm.executor.fundForWithPermit3',
      {
        attributes: {
          'evm.chain_id': chainId.toString(),
          'evm.wallet_type': walletId,
          'evm.fundFor_count': fundForCalls.length,
          'evm.operation': 'fundForWithPermit3',
        },
      },
      async (span) => {
        try {
          this.logger.log(
            `Executing fundForWithPermit3 on chain ${chainId} with ${fundForCalls.length} fundFor calls`,
          );

          // Build single permit3 call
          const permit3EvmCall = this.buildPermit3Call(permit3Params);

          // Build all fundFor calls
          const fundForEvmCalls = fundForCalls.map((params) => this.buildFundForCall(params));

          // Combine all calls into a single array
          const allCalls = [permit3EvmCall, ...fundForEvmCalls];

          span.setAttributes({
            'evm.total_calls': allCalls.length,
            'portal.address': fundForEvmCalls[0]?.to,
          });

          // Get wallet for this chain
          const wallet = this.walletManager.getWallet(walletId, chainId);

          // Execute all calls atomically using multicall3 (writeContracts uses multicall3 by default)
          const [txHash] = await wallet.writeContracts(allCalls);

          span.setAttributes({
            'evm.tx_hash': txHash,
            'evm.status': 'success',
          });

          this.logger.log(
            `Successfully executed fundForWithPermit3 on chain ${chainId}. TxHash: ${txHash}`,
          );

          span.setStatus({ code: api.SpanStatusCode.OK });
          return txHash;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          this.logger.error(
            `Failed to execute fundForWithPermit3 on chain ${chainId}: ${getErrorMessage(error)}`,
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
   * Builds a permit3 transaction call
   * @param params Permit3 parameters
   * @returns EvmCall object with encoded transaction data
   */
  private buildPermit3Call(params: Permit3Params): { to: Address; data: Hex; value: bigint } {
    // Convert UniversalAddress to Hex
    const permitContractHex = AddressNormalizer.denormalizeToEvm(params.permitContract);
    const ownerHex = AddressNormalizer.denormalizeToEvm(params.owner);

    // Convert permits accounts to Hex
    const permitsHex = params.permits.map((p) => ({
      modeOrExpiration: p.modeOrExpiration,
      tokenKey: p.tokenKey,
      account: AddressNormalizer.denormalizeToEvm(p.account),
      amountDelta: p.amountDelta,
    }));

    // Encode the permit function call
    const data = encodeFunctionData({
      abi: permit3Abi,
      functionName: 'permit',
      args: [
        ownerHex,
        params.salt,
        params.deadline,
        params.timestamp,
        {
          chainId: BigInt(params.chainId),
          permits: permitsHex,
        },
        params.merkleProof,
        params.signature,
      ],
    });

    return {
      to: permitContractHex,
      data,
      value: 0n,
    };
  }

  /**
   * Builds a fundFor transaction call
   * @param params FundFor parameters
   * @returns EvmCall object with encoded transaction data
   */
  private buildFundForCall(params: FundForParams): { to: Address; data: Hex; value: bigint } {
    // Convert UniversalAddress to Hex
    const funderHex = AddressNormalizer.denormalizeToEvm(params.funder);
    const permitContractHex = AddressNormalizer.denormalizeToEvm(params.permitContract);

    // Convert reward addresses to Hex
    const rewardHex = {
      deadline: params.reward.deadline,
      creator: AddressNormalizer.denormalizeToEvm(params.reward.creator),
      prover: AddressNormalizer.denormalizeToEvm(params.reward.prover),
      nativeAmount: params.reward.nativeAmount,
      tokens: params.reward.tokens.map((t) => ({
        token: AddressNormalizer.denormalizeToEvm(t.token),
        amount: t.amount,
      })),
    };

    // Get Portal address from config
    const portalAddressUA = this.evmConfigService.getPortalAddress(params.chainId);
    if (!portalAddressUA) {
      throw new Error(`No Portal address configured for chain ${params.chainId}`);
    }
    const portalAddress = AddressNormalizer.denormalizeToEvm(portalAddressUA);

    // Encode the fundFor function call
    const data = encodeFunctionData({
      abi: portalAbi,
      functionName: 'fundFor',
      args: [
        params.destination,
        params.routeHash,
        rewardHex,
        params.allowPartial,
        funderHex,
        permitContractHex,
      ],
    });

    return {
      to: portalAddress,
      data,
      value: params.reward.nativeAmount,
    };
  }
}
