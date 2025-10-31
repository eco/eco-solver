import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import * as api from '@opentelemetry/api';
import { getAddress, keccak256 } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { RhinestoneConfigService } from '@/modules/config/services/rhinestone-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { IQueueService } from '@/modules/queue/interfaces/queue-service.interface';

import { ActionStatusError } from '../types/action-status.types';
import { RelayerActionV1 } from '../types/relayer-action.types';
import { decodeAdapterClaim } from '../utils/decoder';
import { extractIntent } from '../utils/intent-extractor';
import { isValidHexData, normalizeError } from '../utils/validation';

import { RhinestoneWebsocketService } from './rhinestone-websocket.service';

/**
 * Processes RelayerAction events and sends ActionStatus responses within 3 seconds
 */
@Injectable()
export class RhinestoneActionProcessor {
  private readonly logger = new Logger(RhinestoneActionProcessor.name);

  constructor(
    private readonly websocketService: RhinestoneWebsocketService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly otelService: OpenTelemetryService,
    private readonly rhinestoneConfig: RhinestoneConfigService,
  ) {}

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
        const startTime = Date.now();

        try {
          const beforeFillClaim = payload.action.claims.find((claim) => claim.beforeFill === true);
          if (!beforeFillClaim) {
            throw new Error('No beforeFill claim found in RelayerAction');
          }

          if (!payload.action.fill) {
            throw new Error('No fill found in RelayerAction');
          }

          this.validateSettlementLayer(beforeFillClaim);
          this.validateActionIntegrity(payload.action, beforeFillClaim);

          const intent = this.extractIntent(beforeFillClaim);
          this.logger.log(`Extracted intent: ${intent.intentHash}`);
          span.setAttribute('rhinestone.intent_hash', intent.intentHash);

          // TODO: Queue intent for fulfillment
          span.setStatus({ code: api.SpanStatusCode.OK });
        } catch (error) {
          const duration = Date.now() - startTime;

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
   * Validate settlement layer is ECO (only supported layer)
   */
  private validateSettlementLayer(beforeFillClaim: RelayerActionV1['claims'][0]): void {
    const settlementLayer = beforeFillClaim.metadata?.settlementLayer;

    if (!settlementLayer) {
      throw new Error('Settlement layer not specified in claim metadata');
    }

    if (settlementLayer !== 'ECO') {
      throw new Error(`Unsupported settlement layer: ${settlementLayer}. Only 'ECO' is supported.`);
    }
  }

  /**
   * Validate action integrity (router addresses, zero values, cross-chain)
   */
  private validateActionIntegrity(
    action: RelayerActionV1,
    beforeFillClaim: RelayerActionV1['claims'][0],
  ): void {
    const contracts = this.rhinestoneConfig.getContracts();

    const claimRouterAddress = getAddress(beforeFillClaim.call.to);
    const fillRouterAddress = getAddress(action.fill.call.to);
    const expectedRouter = getAddress(contracts.router);

    if (claimRouterAddress !== expectedRouter) {
      throw new Error(
        `Invalid router address in claim. Expected ${expectedRouter}, got ${claimRouterAddress}`,
      );
    }

    if (fillRouterAddress !== expectedRouter) {
      throw new Error(
        `Invalid router address in fill. Expected ${expectedRouter}, got ${fillRouterAddress}`,
      );
    }

    const claimValue = beforeFillClaim.call.value;
    const fillValue = action.fill.call.value;

    let claimValueBigInt: bigint;
    try {
      claimValueBigInt = BigInt(claimValue);
    } catch (error) {
      throw new Error(`Invalid claim value format: ${claimValue}. Must be a valid numeric string.`);
    }

    let fillValueBigInt: bigint;
    try {
      fillValueBigInt = BigInt(fillValue);
    } catch (error) {
      throw new Error(`Invalid fill value format: ${fillValue}. Must be a valid numeric string.`);
    }

    if (claimValueBigInt !== 0n) {
      throw new Error(`Router call in claim must have zero value. Got ${claimValue}`);
    }

    if (fillValueBigInt !== 0n) {
      throw new Error(`Router call in fill must have zero value. Got ${fillValue}`);
    }

    const sourceChainId = beforeFillClaim.call.chainId;
    const destinationChainId = action.fill.call.chainId;

    if (sourceChainId === destinationChainId) {
      throw new Error(
        `Source and destination chains must be different. Both are chain ${sourceChainId}`,
      );
    }
  }

  /**
   * Extract intent from RelayerAction (decodes adapter claim)
   */
  private extractIntent(beforeFillClaim: RelayerActionV1['claims'][0]): Intent {
    if (!beforeFillClaim.call.data) {
      throw new Error('Claim call data is missing');
    }

    const claimCallData = beforeFillClaim.call.data;

    if (!isValidHexData(claimCallData)) {
      throw new Error('Claim call data is not a valid hex string');
    }

    const claimData = decodeAdapterClaim(claimCallData);
    const claimHash = keccak256(claimCallData);
    const sourceChainId = beforeFillClaim.call.chainId;

    return extractIntent(claimData, claimHash, sourceChainId);
  }
}
