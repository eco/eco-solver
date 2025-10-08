import { forwardRef, Inject, Injectable } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { TronWeb } from 'tronweb';
import { erc20Abi, maxUint256 } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';
import {
  BaseChainExecutor,
  ExecutionResult,
} from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { TvmReaderService } from '@/modules/blockchain/tvm/services/tvm.reader.service';
import { BlockchainConfigService, TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';
import { BatchWithdrawData } from '@/modules/withdrawal/interfaces/withdrawal-job.interface';

import { TvmTransactionError } from '../errors';
import { TvmClientUtils, TvmTransactionUtils } from '../utils';

import { TvmWalletManagerService, TvmWalletType } from './tvm-wallet-manager.service';

@Injectable()
export class TvmExecutorService extends BaseChainExecutor {
  constructor(
    private tvmConfigService: TvmConfigService,
    private blockchainConfigService: BlockchainConfigService,
    private walletManager: TvmWalletManagerService,
    @Inject(forwardRef(() => ProverService))
    private proverService: ProverService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
    private readonly tvmReaderService: TvmReaderService,
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
  async fulfill(
    intent: Intent,
    walletId: TvmWalletType = this.tvmConfigService.defaultWallet,
  ): Promise<ExecutionResult> {
    if (!intent.sourceChainId) {
      throw new Error('intent sourceChainId is missing');
    }

    return this.otelService.tracer.startActiveSpan(
      'tvm.executor.fulfill',
      {
        attributes: {
          'tvm.intent_hash': intent.intentHash,
          'tvm.source_chain': intent.sourceChainId.toString(),
          'tvm.destination_chain': intent.destination.toString(),
          'tvm.has_tokens': intent.route.tokens.length > 0,
          'tvm.has_calls': intent.route.calls.length > 0,
          'tvm.reward_deadline': intent.reward.deadline.toString(),
          'tvm.wallet_type': walletId,
          'tvm.operation': 'fulfill',
        },
      },
      async (span) => {
        try {
          // Get the destination chain ID from the intent
          const destinationChainId = this.getChainId(intent.destination);
          const sourceChainId = this.getChainId(intent.sourceChainId);

          // Get wallet
          const wallet = this.walletManager.createWallet(destinationChainId, walletId);
          const walletAddress = await wallet.getAddress();

          // Get claimant from source chain configuration
          const claimantUA = this.blockchainConfigService.getClaimant(sourceChainId);
          const claimant = AddressNormalizer.denormalizeToTvm(claimantUA);

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

          const proverAddrUA = prover.getContractAddress(destinationChainId);
          if (!proverAddrUA) {
            throw new Error(`No prover contract address found for chain ${destinationChainId}`);
          }
          const proverAddr = AddressNormalizer.denormalizeToTvm(proverAddrUA);

          span.setAttributes({
            'tvm.prover_address': proverAddr,
            'tvm.prover_fee': proverFee.toString(),
            'tvm.proof_data_length': proofData.length,
          });

          // Calculate Portal hashes
          const rewardHash = PortalHashUtils.computeRewardHash(intent.reward, intent.sourceChainId);

          const portalAddrUA = this.tvmConfigService.getPortalAddress(destinationChainId);
          const portalAddr = AddressNormalizer.denormalizeToTvm(portalAddrUA);
          span.setAttribute('tvm.portal_address', portalAddr);

          // First, approve all tokens
          const approvalTxIds: string[] = [];
          span.setAttribute('tvm.approval_count', intent.route.tokens.length);

          for (const { token: tokenUniversalAddr, amount } of intent.route.tokens) {
            const tokenAddress = AddressNormalizer.denormalizeToTvm(tokenUniversalAddr);

            const allowance = await this.tvmReaderService.getTokenAllowance(
              tokenUniversalAddr,
              AddressNormalizer.normalizeTvm(walletAddress),
              portalAddrUA,
              destinationChainId,
            );

            if (allowance < amount) {
              span.addEvent('tvm.token.approving', {
                token_address: tokenAddress,
                amount: amount.toString(),
                allowance: allowance.toString(),
              });

              const txId = await wallet.triggerSmartContract(tokenAddress, erc20Abi, 'approve', [
                { type: 'address', value: portalAddr },
                { type: 'uint256', value: maxUint256.toString() },
              ]);

              approvalTxIds.push(txId);
              span.addEvent('tvm.token.approved', { transaction_id: txId });
            } else {
              span.addEvent('tvm.token.approval_skipped', { allowance: allowance.toString() });
            }
          }

          // Wait for all approvals to be confirmed
          if (approvalTxIds.length > 0) {
            await this.waitForTransactions(approvalTxIds, destinationChainId);
          }

          span.addEvent('tvm.fulfillment.submitting');

          // TODO: Approvals and fulfillment must be executed inside a single transaction
          const contract = wallet.tronWeb.contract(portalAbi, portalAddr);

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

          span.setStatus({ code: api.SpanStatusCode.OK });
          return {
            success: true,
            txHash: fulfillTxId,
          };
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          this.logger.error('TVM execution error:', toError(error));
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

  /**
   * Gets the wallet address for a specific wallet type
   * @param walletType - The type of wallet to get address for
   * @param chainId - The chain ID
   * @returns The wallet address
   */
  async getWalletAddress(walletType: any, chainId: bigint | number): Promise<UniversalAddress> {
    const chainIdStr = typeof chainId === 'bigint' ? chainId.toString() : chainId;
    return this.walletManager.getWalletAddress(chainIdStr, walletType);
  }

  /**
   * Checks if a transaction is confirmed on the blockchain
   * @param txHash - The transaction hash to check
   * @param chainId - The chain ID to query
   * @returns True if transaction is confirmed, false otherwise
   */
  async isTransactionConfirmed(txHash: string, chainId: number): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'tvm.executor.isTransactionConfirmed',
      {
        attributes: {
          'tvm.chain_id': chainId.toString(),
          'tvm.transaction_hash': txHash,
          'tvm.operation': 'isTransactionConfirmed',
        },
      },
      async (span) => {
        try {
          const client = this.createTronWebClient(chainId);
          const txInfo = await client.trx.getTransactionInfo(txHash);

          const isConfirmed = txInfo && txInfo.blockNumber && txInfo.receipt?.result === 'SUCCESS';

          span.setAttribute('tvm.transaction_confirmed', isConfirmed);
          span.setStatus({ code: api.SpanStatusCode.OK });
          return Boolean(isConfirmed);
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        } finally {
          span.end();
        }
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
    return this.otelService.tracer.startActiveSpan(
      'tvm.executor.getBalance',
      {
        attributes: {
          'tvm.chain_id': chainId.toString(),
          'tvm.address': address,
          'tvm.operation': 'getBalance',
        },
      },
      async (span) => {
        try {
          const client = this.createTronWebClient(chainId);
          const balance = await client.trx.getBalance(address);

          span.setAttribute('tvm.balance', balance.toString());
          span.setStatus({ code: api.SpanStatusCode.OK });
          return BigInt(balance);
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Executes a batch withdrawal of proven intents on TVM
   * @param chainId - The chain ID where to execute withdrawal
   * @param withdrawalData - The batch withdrawal data
   * @param walletId - Optional wallet type to use
   * @returns Transaction hash
   */
  async executeBatchWithdraw(
    chainId: bigint,
    withdrawalData: BatchWithdrawData,
    walletId: string = this.tvmConfigService.defaultWallet,
  ): Promise<string> {
    return this.otelService.tracer.startActiveSpan(
      'tvm.executor.batchWithdraw',
      {
        attributes: {
          'tvm.chain_id': chainId.toString(),
          'tvm.wallet_type': walletId,
          'tvm.intent_count': withdrawalData.destinations.length,
          'tvm.operation': 'batchWithdraw',
        },
      },
      async (span) => {
        try {
          const chainIdNum = this.getChainId(chainId);

          // Get the wallet for this chain
          const walletType = walletId as TvmWalletType;
          const wallet = this.walletManager.createWallet(chainIdNum, walletType);
          const walletAddress = await wallet.getAddress();

          span.setAttribute('tvm.wallet_address', walletAddress);

          // Get Portal address for the source chain from config
          const portalAddressUA = this.tvmConfigService.getPortalAddress(chainIdNum);
          if (!portalAddressUA) {
            throw new Error(`No Portal address configured for chain ${chainId}`);
          }
          const portalAddress = AddressNormalizer.denormalizeToTvm(portalAddressUA);

          span.setAttribute('portal.address', portalAddress);

          // Create TronWeb client
          const client = this.createTronWebClient(chainIdNum);

          // Convert UniversalAddresses to Tron addresses and prepare the data
          const destinations = withdrawalData.destinations;
          const routeHashes = withdrawalData.routeHashes;

          // Get the Portal contract instance
          const contract = client.contract(portalAbi, portalAddress);

          // Format rewards as tuples for the contract: [deadline, creator, prover, nativeAmount, tokens[]]
          const rewards: Parameters<typeof contract.methods.batchWithdraw>[2] =
            withdrawalData.rewards.map((r) => {
              return [
                r.deadline,
                AddressNormalizer.denormalizeToTvm(r.creator as UniversalAddress),
                AddressNormalizer.denormalizeToTvm(r.prover as UniversalAddress),
                r.nativeAmount,
                r.tokens.map(
                  (t) =>
                    [
                      AddressNormalizer.denormalizeToTvm(t.token as UniversalAddress),
                      t.amount,
                    ] as const,
                ),
              ] as const;
            });

          this.logger.log(
            `Executing batchWithdraw on TVM chain ${chainId} for ${withdrawalData.destinations.length} intents`,
          );

          // Execute the batchWithdraw function
          const result = await contract.methods
            .batchWithdraw(destinations, routeHashes, rewards)
            .send({
              from: walletAddress,
              // Add a fee limit if needed
              feeLimit: 1_000_000_000, // 1000 TRX
            });

          if (!result || typeof result !== 'string') {
            throw new TvmTransactionError('Failed to get transaction ID from batchWithdraw');
          }

          const txHash = result;

          // Wait for transaction confirmation
          const confirmed = await this.waitForTransaction(txHash, chainIdNum);
          if (!confirmed) {
            throw new TvmTransactionError(`Transaction ${txHash} failed or timed out`);
          }

          span.setAttributes({
            'tvm.tx_hash': txHash,
            'tvm.status': 'success',
          });

          this.logger.log(
            `Successfully executed batchWithdraw on TVM chain ${chainId}. TxHash: ${txHash}`,
          );

          span.setStatus({ code: api.SpanStatusCode.OK });
          return txHash;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          this.logger.error(
            `Failed to execute batchWithdraw on TVM chain ${chainId}: ${getErrorMessage(error)}`,
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
   * permit3 is not yet implemented for TVM
   * TODO: Implement when Portal contract supports permit3
   */
  async permit3(): Promise<any> {
    throw new Error('permit3 is not yet implemented for TVM');
  }

  /**
   * fundFor is not yet implemented for TVM
   * TODO: Implement when Portal contract supports gasless intents
   */
  async fundFor(): Promise<any> {
    throw new Error('fundFor is not yet implemented for TVM');
  }

  /**
   * Creates a TronWeb instance for the given chain
   * @param chainId - The chain ID to create client for
   * @returns TronWeb instance
   */
  private createTronWebClient(chainId: number): TronWeb {
    const network = this.tvmConfigService.getChain(chainId);
    return TvmClientUtils.createClient(network);
  }

  private async waitForTransaction(
    txId: string,
    chainId: number,
    maxAttempts?: number,
  ): Promise<boolean> {
    return this.otelService.tracer.startActiveSpan(
      'tvm.executor.waitForTransaction',
      {
        attributes: {
          'tvm.transaction_id': txId,
          'tvm.chain_id': chainId.toString(),
          'tvm.max_attempts': maxAttempts?.toString() || 'default',
        },
      },
      async (span) => {
        try {
          const settings = this.tvmConfigService.getTransactionSettings();
          const client = this.createTronWebClient(chainId);

          const result = await TvmTransactionUtils.waitForTransaction(
            client,
            txId,
            {
              ...settings,
              maxTransactionAttempts: maxAttempts ?? settings.maxTransactionAttempts,
            },
            this.logger,
          );

          span.setAttributes({
            'tvm.transaction_confirmed': result,
          });
          span.setStatus({ code: api.SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private async waitForTransactions(txIds: string[], chainId: number): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'tvm.executor.waitForTransactions',
      {
        attributes: {
          'tvm.transaction_count': txIds.length,
          'tvm.chain_id': chainId.toString(),
          'tvm.transaction_ids': txIds.join(','),
        },
      },
      async (span) => {
        try {
          const settings = this.tvmConfigService.getTransactionSettings();
          const client = this.createTronWebClient(chainId);

          await TvmTransactionUtils.waitForTransactions(client, txIds, settings, this.logger);

          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: getErrorMessage(error),
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private getChainId(chainId: bigint | number): number {
    if (typeof chainId === 'bigint') {
      return Number(chainId);
    }
    return chainId;
  }
}
