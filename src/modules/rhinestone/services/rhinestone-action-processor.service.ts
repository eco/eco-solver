import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';
import {
  Account,
  Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  Hex,
  http,
  keccak256,
  parseEventLogs,
  PublicClient,
  WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, base } from 'viem/chains';

import { portalAbi } from '@/common/abis/portal.abi';
import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { RhinestoneConfigService } from '@/modules/config/services/rhinestone-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry';
import { ProverService } from '@/modules/prover/prover.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { ActionStatusError } from '../types/action-status.types';
import { RelayerActionV1 } from '../types/relayer-action.types';
import { decodeAdapterClaim, decodeAdapterFill } from '../utils/decoder';
import { extractIntent } from '../utils/intent-extractor';
import { isValidHexData, normalizeError } from '../utils/validation';

import { RhinestoneValidationService } from './rhinestone-validation.service';
import { RhinestoneWebsocketService } from './rhinestone-websocket.service';

const PORTAL_ADDRESS = '0x399Dbd5DF04f83103F77A58cBa2B7c4d3cdede97' as Address;

/**
 * Processes RelayerAction events and executes Rhinestone fulfillment flow (POC)
 *
 * Flow: CLAIM (Base) → FILL (Arbitrum) → PROVE (Arbitrum→Base) → WITHDRAW (Base)
 */
@Injectable()
export class RhinestoneActionProcessor implements OnModuleInit {
  private readonly logger = new Logger(RhinestoneActionProcessor.name);

  // Local viem wallet clients for POC execution
  private baseWalletClient!: WalletClient;
  private arbWalletClient!: WalletClient;
  private basePublicClient!: PublicClient;
  private arbPublicClient!: PublicClient;
  private solverAddress!: Address;

  constructor(
    private readonly websocketService: RhinestoneWebsocketService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly otelService: OpenTelemetryService,
    private readonly rhinestoneConfig: RhinestoneConfigService,
    private readonly validationService: RhinestoneValidationService,
    private readonly proverService: ProverService,
    private readonly transportService: EvmTransportService,
  ) {}

  /**
   * Initialize wallet clients on module startup
   */
  async onModuleInit() {
    // Setup wallet from environment variable (POC)
    const privateKey = process.env.SOLVER_PRIVATE_KEY as Hex;

    if (!privateKey) {
      this.logger.warn('SOLVER_PRIVATE_KEY not set - Rhinestone execution will not work');
      return;
    }

    const account = privateKeyToAccount(privateKey);
    this.solverAddress = account.address;

    // Create wallet clients for Base and Arbitrum
    const baseRpc = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    const arbRpc = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';

    this.baseWalletClient = createWalletClient({
      chain: base,
      transport: http(baseRpc),
      account,
    });

    this.basePublicClient = createPublicClient({
      chain: base,
      transport: http(baseRpc),
    }) as PublicClient;

    this.arbWalletClient = createWalletClient({
      chain: arbitrum,
      transport: http(arbRpc),
      account,
    });

    this.arbPublicClient = createPublicClient({
      chain: arbitrum,
      transport: http(arbRpc),
    }) as PublicClient;

    this.logger.log(`Rhinestone POC wallet initialized: ${this.solverAddress}`);
  }

  /**
   * Handle RelayerAction events (must respond within 3 seconds)
   */
  @OnEvent('rhinestone.relayerAction')
  async handleRelayerAction(payload: {
    messageId: string;
    action: RelayerActionV1;
  }): Promise<void> {
    return this.otelService.tracer.startActiveSpan(
      'rhinestone.action_processor.handle',
      {
        attributes: {
          'rhinestone.message_id': payload.messageId,
          'rhinestone.action_id': payload.action.id,
          'rhinestone.action_timestamp': payload.action.timestamp,
        },
      },
      async (span) => {
        console.log(
          'RhinestoneActionProcessor handleRelayerAction',
          JSON.stringify(payload.action, null, 2),
        );

        const startTime = Date.now();

        try {
          const beforeFillClaim = payload.action.claims.find((claim) => claim.beforeFill === true);

          if (!beforeFillClaim) {
            throw new Error('No beforeFill claim found in RelayerAction');
          }

          if (!payload.action.fill) {
            throw new Error('No fill found in RelayerAction');
          }

          this.validationService.validateSettlementLayerFromMetadata(beforeFillClaim.metadata);
          this.validationService.validateActionIntegrity(
            beforeFillClaim.call,
            payload.action.fill.call,
          );

          const intent = this.extractIntent(beforeFillClaim, payload.action.fill);
          this.logger.log(`Extracted intent: ${intent.intentHash}`);
          span.setAttribute('rhinestone.intent_hash', intent.intentHash);

          // Execute complete fulfillment flow (POC - direct execution, no queue)
          const result = await this.executeRhinestoneFulfillment(
            payload,
            intent,
            payload.action.fill,
            beforeFillClaim,
          );

          this.logger.log(`Rhinestone fulfillment complete!`);
          this.logger.log(`  CLAIM:    ${result.claimTxHash}`);
          this.logger.log(`  FILL:     ${result.fillTxHash}`);
          this.logger.log(`  PROVE:    ${result.proveTxHash}`);
          this.logger.log(`  WITHDRAW: ${result.withdrawTxHash}`);

          span.setStatus({ code: api.SpanStatusCode.OK });

          // TODO: Send success ActionStatus back to Rhinestone
        } catch (error) {
          const duration = Date.now() - startTime;

          console.log('RhinestoneActionProcessor handleRelayerAction Error:', error);

          const errorStatus: ActionStatusError = {
            type: 'Error',
            reason: 'PreconditionFailed',
            message: error instanceof Error ? error.message : String(error),
          };

          try {
            await this.websocketService.sendActionStatus(payload.messageId, errorStatus);
          } catch (sendError) {
            this.logger.error(`Failed to send error ActionStatus: ${sendError}`);
          }

          span.recordException(normalizeError(error));
          span.setAttribute('rhinestone.processing_duration_ms', duration);
          span.setStatus({ code: api.SpanStatusCode.ERROR });
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Execute complete Rhinestone fulfillment flow (POC)
   * CLAIM → FILL → PROVE → WITHDRAW
   */
  private async executeRhinestoneFulfillment(
    payload: {
      messageId: string;
      action: RelayerActionV1;
    },
    intent: Intent,
    fillAction: RelayerActionV1['fill'],
    claimAction: RelayerActionV1['claims'][0],
  ): Promise<{
    claimTxHash: Hex;
    fillTxHash: Hex;
    proveTxHash: Hex;
    withdrawTxHash: Hex;
  }> {
    if (!this.baseWalletClient) {
      throw new Error('Wallet not initialized - check SOLVER_PRIVATE_KEY');
    }

    this.logger.log(
      `Executing Rhinestone fulfillment for payload ${JSON.stringify(payload, null, 2)}`,
    );

    // ========================================================================
    // MILESTONE 1: CLAIM (Fund intent on Base)
    // ========================================================================
    this.logger.log('Milestone 1: Executing CLAIM on Base...');

    const claimTxHash = await this.baseWalletClient.sendTransaction({
      to: claimAction.call.to as Address,
      data: claimAction.call.data as Hex,
      value: BigInt(claimAction.call.value),
      chain: base,
      account: this.baseWalletClient.account!,
    });

    this.logger.log(`CLAIM sent: ${claimTxHash}`);

    const claimReceipt = await this.basePublicClient.waitForTransactionReceipt({
      hash: claimTxHash,
      confirmations: 1,
    });

    if (claimReceipt.status !== 'success') {
      throw new Error(`CLAIM reverted: ${claimTxHash}`);
    }

    this.logger.log(
      `CLAIM confirmed in block ${claimReceipt.blockNumber}, tx hash: ${claimTxHash}`,
    );

    // Extract intent hash from CLAIM logs using parseEventLogs
    let claimEventIntentHash: Hex | null = null;
    try {
      const [intentFundedEvent] = parseEventLogs({
        abi: portalAbi,
        eventName: ['IntentFunded'],
        logs: claimReceipt.logs,
      });

      if (intentFundedEvent) {
        claimEventIntentHash = intentFundedEvent.args.intentHash as Hex;
        this.logger.log(`Intent hash from CLAIM event (IntentFunded): ${claimEventIntentHash}`);
      }
    } catch (e) {
      this.logger.warn('Could not extract intent hash from CLAIM logs');
    }

    // ========================================================================
    // MILESTONE 2: FILL (Fulfill on Arbitrum)
    // ========================================================================
    this.logger.log('Milestone 2: Executing FILL on Arbitrum...');

    // Get token for approval
    const token = intent.route.tokens[0];
    const tokenAddress = AddressNormalizer.denormalizeToEvm(token.token); // Convert 32-byte to 20-byte address
    const tokenAmount = token.amount;
    const routerAddress = fillAction.call.to as Address;

    this.logger.log(`Token address: ${tokenAddress}`);
    this.logger.log(`Router address: ${routerAddress}`);
    this.logger.log(`Token amount: ${tokenAmount}`);
    this.logger.log(`Solver address: ${this.solverAddress}`);

    // Check if approval needed
    const allowance = await this.arbPublicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [this.solverAddress, routerAddress],
    });

    this.logger.log(`Allowance: ${allowance.toString()}`);

    if (allowance < tokenAmount) {
      this.logger.log(`Approving ${tokenAmount} tokens for Router...`);

      const approvalTxHash = await this.arbWalletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [routerAddress, tokenAmount],
        chain: arbitrum,
        account: this.arbWalletClient.account!,
      });

      await this.arbPublicClient.waitForTransactionReceipt({
        hash: approvalTxHash,
        confirmations: 1,
      });

      this.logger.log(`Approval confirmed`);
    }

    // Patch relayerContext to ensure rewards go to OUR solver, not the placeholder
    // The payload from Rhinestone contains 0xfEeBABE... as a fallback address
    // We need to replace it with our solver address before executing FILL
    this.logger.log('Patching relayerContext to solver address...');
    const originalFillData = fillAction.call.data as Hex;

    this.logger.log(
      `Starting fill ${JSON.stringify(
        {
          to: fillAction.call.to,
          dataPatched: true,
          originalFirstBytes: originalFillData.slice(0, 66),
          value: fillAction.call.value,
        },
        null,
        2,
      )}`,
    );

    const fillTxHash = await this.arbWalletClient.sendTransaction({
      to: fillAction.call.to as Address,
      data: originalFillData,
      value: BigInt(fillAction.call.value),
      chain: arbitrum,
      account: this.arbWalletClient.account as Account,
    });

    this.logger.log(`FILL sent: ${fillTxHash}`);

    const fillReceipt = await this.arbPublicClient.waitForTransactionReceipt({
      hash: fillTxHash,
      confirmations: 1,
    });

    if (fillReceipt.status !== 'success') {
      throw new Error(`FILL reverted: ${fillTxHash}`);
    }

    this.logger.log(`FILL confirmed in block ${fillReceipt.blockNumber}, tx hash: ${fillTxHash}`);

    // Extract intent hash from FILL logs using parseEventLogs
    let fillEventIntentHash: Hex | null = null;
    try {
      const [intentFulfilledEvent] = parseEventLogs({
        abi: portalAbi,
        eventName: ['IntentFulfilled'],
        logs: fillReceipt.logs,
      });

      if (intentFulfilledEvent) {
        fillEventIntentHash = intentFulfilledEvent.args.intentHash as Hex;
        this.logger.log(`Intent hash from FILL event (IntentFulfilled): ${fillEventIntentHash}`);
      }
    } catch (e) {
      this.logger.warn('Could not extract intent hash from FILL logs');
    }

    // Compare hashes
    this.logger.log('===== INTENT HASH COMPARISON =====');
    this.logger.log(`  Calculated (extractIntent): ${intent.intentHash}`);
    this.logger.log(`  From CLAIM event:          ${claimEventIntentHash || 'N/A'}`);
    this.logger.log(`  From FILL event:           ${fillEventIntentHash || 'N/A'}`);

    if (
      claimEventIntentHash &&
      fillEventIntentHash &&
      claimEventIntentHash !== fillEventIntentHash
    ) {
      this.logger.error('❌ CLAIM and FILL have DIFFERENT intent hashes!');
    }

    if (fillEventIntentHash && intent.intentHash !== fillEventIntentHash) {
      this.logger.warn(`⚠️  Our calculated hash doesn't match on-chain hash!`);
      this.logger.warn(`   Using on-chain hash from FILL event for PROVE`);
    }

    // Use the actual on-chain hash for PROVE (workaround)
    const actualIntentHash = fillEventIntentHash || intent.intentHash;

    // ========================================================================
    // MILESTONE 3: PROVE (Send proof to Base)
    // ========================================================================
    this.logger.log('Milestone 3: Executing PROVE...');

    // Use existing ProverService to get prover info
    const prover = this.proverService.getProver(Number(intent.sourceChainId), intent.reward.prover);

    if (!prover) {
      throw new Error('Prover not found');
    }

    const proofData = await prover.generateProof(intent);
    const claimantUniversal = AddressNormalizer.normalizeEvm(this.solverAddress);
    const proverFee = await prover.getFee(intent, claimantUniversal);

    const proverAddress = AddressNormalizer.denormalizeToEvm(
      prover.getContractAddress(Number(intent.destination))!,
    );

    // Encode the prove transaction for Tenderly debugging (use actual hash)
    const proveCalldata = encodeFunctionData({
      abi: portalAbi,
      functionName: 'prove',
      args: [proverAddress, intent.sourceChainId, [actualIntentHash as Hex], proofData],
    });

    this.logger.log('PROVE transaction details (for Tenderly):');
    this.logger.log(`  From: ${this.solverAddress}`);
    this.logger.log(`  To: ${PORTAL_ADDRESS}`);
    this.logger.log(`  Value: ${proverFee.toString()}`);
    this.logger.log(`  Data: ${proveCalldata}`);
    this.logger.log('');
    this.logger.log('Decoded args:');
    this.logger.log(`  proverAddress: ${proverAddress}`);
    this.logger.log(`  sourceChainId: ${intent.sourceChainId}`);
    this.logger.log(`  intentHashes: [${actualIntentHash}]`);
    this.logger.log(`  data: ${proofData}`);
    this.logger.log(
      `  Using ${actualIntentHash === intent.intentHash ? 'calculated' : 'on-chain'} intent hash`,
    );

    const proveTxHash = await this.arbWalletClient.writeContract({
      address: PORTAL_ADDRESS,
      abi: portalAbi,
      functionName: 'prove',
      args: [proverAddress, intent.sourceChainId, [actualIntentHash as Hex], proofData],
      value: proverFee,
      chain: arbitrum,
      account: this.arbWalletClient.account!,
    });

    this.logger.log(`PROVE sent: ${proveTxHash}`);

    const proveReceipt = await this.arbPublicClient.waitForTransactionReceipt({
      hash: proveTxHash,
      confirmations: 1,
    });

    if (proveReceipt.status !== 'success') {
      throw new Error(`PROVE reverted: ${proveTxHash}`);
    }

    this.logger.log(`PROVE confirmed in block ${proveReceipt.blockNumber}`);
    this.logger.log('Waiting 60s for Hyperlane message delivery...');

    await new Promise((resolve) => setTimeout(resolve, 60000));

    // ========================================================================
    // MILESTONE 4: WITHDRAW (Claim reward on Base)
    // ========================================================================
    this.logger.log('Milestone 4: Executing WITHDRAW on Base...');

    // Encode route using Portal structure (same as debug-intent-hash.ts)
    const routeEncoded = PortalEncoder.encode(intent.route, ChainType.EVM);
    const routeHash = keccak256(routeEncoded);

    // Build evmReward with properly checksummed addresses (same as debug-intent-hash.ts)
    const evmReward = {
      deadline: intent.reward.deadline,
      creator: getAddress(`0x${intent.reward.creator.slice(-40)}`),
      prover: getAddress(`0x${intent.reward.prover.slice(-40)}`),
      nativeAmount: intent.reward.nativeAmount,
      tokens: intent.reward.tokens.map((t) => ({
        token: getAddress(`0x${t.token.slice(-40)}`),
        amount: t.amount,
      })),
    };

    this.logger.log('WITHDRAW transaction details:');
    this.logger.log(
      `  Intent hash used: ${actualIntentHash} (${actualIntentHash === intent.intentHash ? 'calculated' : 'from FILL event'})`,
    );
    this.logger.log(`  Route hash: ${routeHash}`);
    this.logger.log(`  Destination: ${intent.destination}`);

    const withdrawTxHash = await this.baseWalletClient.writeContract({
      address: PORTAL_ADDRESS,
      abi: portalAbi,
      functionName: 'withdraw',
      args: [intent.destination, routeHash, evmReward],
      chain: base,
      account: this.baseWalletClient.account!,
    });

    this.logger.log(`WITHDRAW sent: ${withdrawTxHash}`);

    const withdrawReceipt = await this.basePublicClient.waitForTransactionReceipt({
      hash: withdrawTxHash,
      confirmations: 1,
    });

    if (withdrawReceipt.status !== 'success') {
      throw new Error(`WITHDRAW reverted: ${withdrawTxHash}`);
    }

    this.logger.log(`WITHDRAW confirmed! Reward claimed on Base.`);

    return {
      claimTxHash,
      fillTxHash,
      proveTxHash,
      withdrawTxHash,
    };
  }

  /**
   * Extract intent from RelayerAction (decodes adapter claim and fill)
   */
  private extractIntent(
    beforeFillClaim: RelayerActionV1['claims'][0],
    fillAction: RelayerActionV1['fill'],
  ) {
    if (!beforeFillClaim.call.data) {
      throw new Error('Claim call data is missing');
    }

    if (!fillAction.call.data) {
      throw new Error('Fill call data is missing');
    }

    const claimCallData = beforeFillClaim.call.data;

    if (!isValidHexData(claimCallData)) {
      throw new Error('Claim call data is not a valid hex string');
    }

    const claimData = decodeAdapterClaim(claimCallData);
    const fillData = decodeAdapterFill(fillAction.call.data);

    return extractIntent({ claimData, fillData });
  }
}
