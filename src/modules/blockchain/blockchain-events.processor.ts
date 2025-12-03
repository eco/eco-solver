import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';
import { Job } from 'bullmq';

import { IntentDiscovery } from '@/common/enums/intent-discovery.enum';
import { Intent } from '@/common/interfaces/intent.interface';
import { BigintSerializer } from '@/common/utils/bigint-serializer';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { EvmEventParser } from '@/modules/blockchain/evm/utils/evm-event-parser';
import { BlockchainEventJob } from '@/modules/blockchain/interfaces/blockchain-event-job.interface';
import { TvmEventParser } from '@/modules/blockchain/tvm/utils/tvm-event-parser';
import { EventsService } from '@/modules/events/events.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { IntentDiscoveryService } from '@/modules/intents/services/intent-discovery.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { BullMQOtelFactory } from '@/modules/opentelemetry/bullmq-otel.factory';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

@Processor(QueueNames.BLOCKCHAIN_EVENTS, {
  prefix: `{${QueueNames.BLOCKCHAIN_EVENTS}}`,
})
export class BlockchainEventsProcessor extends WorkerHost implements OnModuleInit, OnModuleDestroy {
  constructor(
    private fulfillmentService: FulfillmentService,
    private eventsService: EventsService,
    private intentDiscoveryService: IntentDiscoveryService,
    private readonly logger: SystemLoggerService,
    @Inject(BullMQOtelFactory) private bullMQOtelFactory: BullMQOtelFactory,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext(BlockchainEventsProcessor.name);
  }

  onModuleInit() {
    // Add telemetry if available
    if (this.worker) {
      const telemetry = this.bullMQOtelFactory.getInstance();
      if (telemetry && !this.worker.opts.telemetry) {
        this.worker.opts.telemetry = telemetry;
        this.logger.log('Added BullMQOtel telemetry to BlockchainEventsProcessor worker');
      }
    }
  }

  async onModuleDestroy() {
    // Close the worker to ensure clean shutdown
    if (this.worker) {
      this.logger.log('Closing BlockchainEventsProcessor worker...');
      await this.worker.close();
      this.logger.log('BlockchainEventsProcessor worker closed');
    }
  }

  async process(job: Job<string>) {
    if (job.name === 'process-blockchain-event') {
      const jobData = BigintSerializer.deserialize<BlockchainEventJob>(job.data);

      this.logger.log(
        `Processing blockchain event: ${jobData.contractName}-${jobData.eventType} for intent ${jobData.intentHash} from ${jobData.chainType} chain ${jobData.chainId}`,
      );

      // Start a new span for event processing
      return this.otelService.tracer.startActiveSpan(
        'blockchain.events.process',
        {
          attributes: {
            'blockchain.event.type': jobData.eventType,
            'blockchain.event.chain_id': jobData.chainId.toString(),
            'blockchain.event.chain_type': jobData.chainType,
            'blockchain.event.contract': jobData.contractName,
            'blockchain.event.intent_hash': jobData.intentHash,
            'blockchain.event.tx_hash': jobData.metadata.txHash,
          },
        },
        async (span) => {
          try {
            await this.processEvent(jobData);
            span.setStatus({ code: api.SpanStatusCode.OK });
          } catch (error) {
            this.logger.error(
              `Failed to process blockchain event ${jobData.eventType}: ${getErrorMessage(error)}`,
              toError(error),
            );
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

  private async processEvent(jobData: BlockchainEventJob): Promise<void> {
    switch (jobData.eventType) {
      case 'IntentPublished':
        await this.handleIntentPublished(jobData);
        break;

      case 'IntentFunded':
        await this.handleIntentFunded(jobData);
        break;

      case 'IntentFulfilled':
        await this.handleIntentFulfilled(jobData);
        break;

      case 'IntentWithdrawn':
        await this.handleIntentWithdrawn(jobData);
        break;

      case 'IntentProven':
        await this.handleIntentProven(jobData);
        break;

      default:
        throw new Error(`Unknown event type: ${jobData.eventType}`);
    }
  }

  private async handleIntentPublished(jobData: BlockchainEventJob): Promise<void> {
    let intent: Intent;

    // Parse intent based on chain type
    switch (jobData.chainType) {
      case 'evm':
        intent = EvmEventParser.parseIntentPublish(BigInt(jobData.chainId), jobData.eventData);
        intent.publishTxHash = jobData.metadata.txHash || undefined;
        break;

      case 'svm':
        // For Solana, eventData is already the parsed intent
        intent = jobData.eventData;
        break;

      case 'tvm':
        // For Tron, eventData is already the parsed intent
        intent = jobData.eventData;
        break;

      default:
        throw new Error(`Unsupported chain type for IntentPublished: ${jobData.chainType}`);
    }

    // Only process intents discovered via blockchain events
    // Skip intents discovered via other methods (rhinestone-websocket, api, etc.)
    const discovery = await this.intentDiscoveryService.getDiscovery(intent.intentHash);

    if (discovery !== IntentDiscovery.BLOCKCHAIN_EVENT) {
      this.logger.log(
        `Intent ${intent.intentHash} discovered via ${discovery}, ` +
          `skipping blockchain event processing (only handles blockchain-event discoveries)`,
      );
      return;
    }

    // Submit intent to fulfillment service (standard flow)
    // Processes if:
    // - Intent doesn't exist (new intent from blockchain)
    // - Intent exists with discovery='blockchain-event' (retry scenario)
    // - Intent exists without discovery field (treated as blockchain-event for backward compat)
    try {
      await this.fulfillmentService.submitIntent(intent);
    } catch (error) {
      this.logger.error(`Failed to submit intent ${intent.intentHash}:`, toError(error));
      throw error;
    }
  }

  private async handleIntentFunded(jobData: BlockchainEventJob): Promise<void> {
    let event: any;

    // Parse event based on chain type
    switch (jobData.chainType) {
      case 'svm':
        // For Solana, eventData is already parsed
        event = jobData.eventData;
        break;

      case 'evm':
      case 'tvm':
        // IntentFunded events are currently only supported on SVM (Solana)
        // EVM and TVM chains may not emit this event type
        this.logger.warn(
          `IntentFunded events are not yet supported on ${jobData.chainType} chains. Skipping event for intent ${jobData.intentHash}`,
        );
        return;

      default:
        throw new Error(`Unsupported chain type for IntentFunded: ${jobData.chainType}`);
    }

    this.eventsService.emit('intent.funded', event);
    this.logger.log(`IntentFunded event emitted for intent ${jobData.intentHash}`);
  }

  private async handleIntentFulfilled(jobData: BlockchainEventJob): Promise<void> {
    let event: any;

    // Parse event based on chain type
    switch (jobData.chainType) {
      case 'evm':
        event = EvmEventParser.parseIntentFulfilled(BigInt(jobData.chainId), jobData.eventData);
        break;

      case 'svm':
        // For Solana, eventData is already parsed
        event = jobData.eventData;
        break;

      case 'tvm':
        event = TvmEventParser.parseTvmIntentFulfilled(BigInt(jobData.chainId), jobData.eventData);
        break;

      default:
        throw new Error(`Unsupported chain type for IntentFulfilled: ${jobData.chainType}`);
    }

    this.eventsService.emit('intent.fulfilled', event);
    this.logger.log(`IntentFulfilled event emitted for intent ${jobData.intentHash}`);
  }

  private async handleIntentWithdrawn(jobData: BlockchainEventJob): Promise<void> {
    let event: any;

    // Parse event based on chain type
    switch (jobData.chainType) {
      case 'evm':
        event = EvmEventParser.parseIntentWithdrawn(jobData.chainId, jobData.eventData);
        break;

      case 'svm':
        // For Solana, eventData is already parsed
        event = jobData.eventData;
        break;

      case 'tvm':
        event = TvmEventParser.parseIntentWithdrawnEvent(jobData.eventData, jobData.chainId);
        break;

      default:
        throw new Error(`Unsupported chain type for IntentWithdrawn: ${jobData.chainType}`);
    }

    this.eventsService.emit('intent.withdrawn', event);
    this.logger.log(`IntentWithdrawn event emitted for intent ${jobData.intentHash}`);
  }

  private async handleIntentProven(jobData: BlockchainEventJob): Promise<void> {
    let event: any;

    // Parse event based on chain type
    switch (jobData.chainType) {
      case 'evm':
        event = EvmEventParser.parseIntentProven(jobData.chainId, jobData.eventData);
        break;

      case 'svm':
        // For Solana, eventData would be parsed when prover support is added
        event = jobData.eventData;
        break;

      case 'tvm':
        event = TvmEventParser.parseIntentProvenEvent(jobData.eventData, jobData.chainId);
        break;

      default:
        throw new Error(`Unsupported chain type for IntentProven: ${jobData.chainType}`);
    }

    this.eventsService.emit('intent.proven', event);
    this.logger.log(
      `IntentProven event emitted for intent ${jobData.intentHash} from ${jobData.metadata.proverType || 'unknown'} prover`,
    );
  }
}
