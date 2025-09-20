import { Injectable } from '@nestjs/common';

import { EventParser } from '@coral-xyz/anchor';
import * as api from '@opentelemetry/api';
import { Connection, Logs, PublicKey } from '@solana/web3.js';

// Route type now comes from intent.interface.ts
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { toError } from '@/common/utils/error-handler';
import {
  IntentFulfilledInstruction,
  IntentPublishedInstruction,
  IntentWithdrawnInstruction,
} from '@/modules/blockchain/svm/targets/types/portal-idl-coder.type';
import { portalBorshCoder } from '@/modules/blockchain/svm/utils/portal-borsh-coder';
import { SvmEventParser } from '@/modules/blockchain/svm/utils/svm-event-parser';
import { SolanaConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

@Injectable()
export class SolanaListener extends BaseChainListener {
  private connection: Connection;
  private programId: PublicKey;
  private subscriptionId: number;
  private parser: EventParser;

  constructor(
    private solanaConfigService: SolanaConfigService,
    private eventsService: EventsService,
    private fulfillmentService: FulfillmentService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(SolanaListener.name);

    this.parser = new EventParser(
      new PublicKey(this.solanaConfigService.portalProgramId),
      portalBorshCoder,
    );
  }

  async start(): Promise<void> {
    this.connection = new Connection(this.solanaConfigService.rpcUrl, {
      wsEndpoint: this.solanaConfigService.wsUrl,
      commitment: 'confirmed',
    });

    // Get Portal program ID from Solana config service
    const portalProgramId = this.solanaConfigService.portalProgramId;

    if (!portalProgramId) {
      throw new Error('Portal program ID not configured in Solana config');
    }

    this.programId = new PublicKey(portalProgramId);

    this.subscriptionId = this.connection.onLogs(
      this.programId,
      this.handleProgramLogs.bind(this),
      'confirmed',
    );

    // TODO: Listen to IntentProven events on the prover programs

    this.logger.log(
      `Solana listener started for Portal program ${this.programId.toString()}. Listening for IntentPublished, IntentFulfilled, IntentProven, and IntentWithdrawn events.`,
    );
  }

  async stop(): Promise<void> {
    if (this.subscriptionId && this.connection) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
    }
    this.logger.log('Solana listener stopped');
  }

  private async handleProgramLogs(logs: Logs): Promise<void> {
    try {
      for (const ev of this.parser.parseLogs(logs.logs)) {
        await this.otelService.tracer.startActiveSpan(
          'svm.listener.processEvent',
          {
            attributes: {
              'svm.chain_id': this.solanaConfigService.chainId.toString(),
              'svm.event_name': ev.name,
              'portal.program_id': this.programId.toString(),
              'svm.signature': logs.signature || 'unknown',
            },
          },
          async (span) => {
            try {
              switch (ev.name) {
                case 'IntentPublished':
                  const intent = SvmEventParser.parseIntentPublishEvent(
                    ev.data as IntentPublishedInstruction,
                    logs,
                    this.solanaConfigService.chainId,
                  );

                  span.setAttributes({
                    'svm.intent_hash': intent.intentHash,
                    'svm.source_chain': intent.sourceChainId?.toString(),
                    'svm.destination_chain': intent.destination.toString(),
                    'svm.creator': intent.reward.creator,
                    'svm.prover': intent.reward.prover,
                  });

                  // Submit intent directly to fulfillment service (span context is automatically propagated)
                  try {
                    await this.fulfillmentService.submitIntent(intent);
                    this.logger.log(`Intent ${intent.intentHash} submitted to fulfillment queue`);
                  } catch (error) {
                    this.logger.error(
                      `Failed to submit intent ${intent.intentHash}:`,
                      toError(error),
                    );
                    span.recordException(toError(error));
                  }

                  span.addEvent('intent.emitted');
                  break;

                case 'IntentFulfilled':
                  const fulfilledEvent = SvmEventParser.parseIntentFulfilledEvent(
                    ev.data as IntentFulfilledInstruction,
                    logs,
                    this.solanaConfigService.chainId,
                  );

                  span.setAttributes({
                    'svm.intent_hash': fulfilledEvent.intentHash,
                    'svm.claimant': fulfilledEvent.claimant || 'unknown',
                  });

                  // Emit the event (span context is automatically propagated)
                  this.eventsService.emit('intent.fulfilled', fulfilledEvent);
                  span.addEvent('intent.fulfilled.emitted');
                  break;

                case 'IntentWithdrawn':
                  const withdrawnEvent = SvmEventParser.parseIntentWithdrawnFromLogs(
                    ev.data as IntentWithdrawnInstruction,
                    logs,
                    this.solanaConfigService.chainId,
                  );

                  span.setAttributes({
                    'svm.intent_hash': withdrawnEvent.intentHash,
                    'svm.claimant': withdrawnEvent.claimant || 'unknown',
                  });

                  // Emit the event (span context is automatically propagated)
                  this.eventsService.emit('intent.withdrawn', withdrawnEvent);
                  span.addEvent('intent.withdrawn.emitted');
                  break;

                default:
                  this.logger.debug(`Unknown event type: ${ev.name}`, ev);
                  span.setAttribute('svm.unknown_event', true);
              }

              span.setStatus({ code: api.SpanStatusCode.OK });
            } catch (eventError) {
              this.logger.error(`Error processing ${ev.name} event:`, toError(eventError));
              span.recordException(toError(eventError));
              span.setStatus({ code: api.SpanStatusCode.ERROR });
            } finally {
              span.end();
            }
          },
        );
      }
    } catch (error) {
      this.logger.error('Error handling Solana program logs:', toError(error));
    }
  }
}
