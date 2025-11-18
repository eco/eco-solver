import { Injectable } from '@nestjs/common';

import { EventParser } from '@coral-xyz/anchor';
import { Connection, Logs, PublicKey } from '@solana/web3.js';

// Route type now comes from intent.interface.ts
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { toError } from '@/common/utils/error-handler';
import { BlockchainEventJob } from '@/modules/blockchain/interfaces/blockchain-event-job.interface';
import {
  IntentFulfilledInstruction,
  IntentFundedInstruction,
  IntentPublishedInstruction,
  IntentWithdrawnInstruction,
} from '@/modules/blockchain/svm/targets/types/portal-idl-coder.type';
import { portalBorshCoder } from '@/modules/blockchain/svm/utils/portal-borsh-coder';
import { SvmEventParser } from '@/modules/blockchain/svm/utils/svm-event-parser';
import { SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueService } from '@/modules/queue/queue.service';

@Injectable()
export class SolanaListener extends BaseChainListener {
  private connection: Connection;
  private programId: PublicKey;
  private portalSubscriptionId: number;
  private parser: EventParser;

  constructor(
    private solanaConfigService: SolanaConfigService,
    private readonly logger: SystemLoggerService,
    private readonly queueService: QueueService,
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

    // Subscribe to Portal program logs
    this.portalSubscriptionId = this.connection.onLogs(
      this.programId,
      this.handleProgramLogs.bind(this),
      'confirmed',
    );

    this.logger.log(
      `Solana listener started for Portal program ${this.programId.toString()}. Listening for IntentPublished, IntentFulfilled, and IntentWithdrawn events.`,
    );
  }

  async stop(): Promise<void> {
    if (this.portalSubscriptionId && this.connection) {
      await this.connection.removeOnLogsListener(this.portalSubscriptionId);
    }
    this.logger.log('Solana listener stopped');
  }

  private async handleProgramLogs(logs: Logs): Promise<void> {
    try {
      for (const ev of this.parser.parseLogs(logs.logs)) {
        try {
          switch (ev.name) {
            case 'IntentPublished':
              const intent = SvmEventParser.parseIntentPublishEvent(
                ev.data as IntentPublishedInstruction,
                logs,
                this.solanaConfigService.chainId,
              );

              // Queue the event for processing
              const publishedJob: BlockchainEventJob = {
                eventType: 'IntentPublished',
                chainId: this.solanaConfigService.chainId,
                chainType: 'svm',
                contractName: 'portal',
                intentHash: intent.intentHash,
                eventData: intent, // For Solana, we pass the parsed intent
                metadata: {
                  txHash: logs.signature || undefined,
                  contractAddress: this.programId.toString(),
                },
              };

              await this.queueService.addBlockchainEvent(publishedJob);
              this.logger.debug(
                `Queued IntentPublished event for intent ${intent.intentHash} from Solana`,
              );
              break;

            case 'IntentFunded':
              const fundedEvent = SvmEventParser.parseIntentFundedEvent(
                ev.data as IntentFundedInstruction,
                logs,
                this.solanaConfigService.chainId,
              );

              const fundedJob: BlockchainEventJob = {
                eventType: 'IntentFunded',
                chainId: this.solanaConfigService.chainId,
                chainType: 'svm',
                contractName: 'portal',
                intentHash: fundedEvent.intentHash,
                eventData: fundedEvent,
                metadata: {
                  txHash: logs.signature || undefined,
                  contractAddress: this.programId.toString(),
                },
              };

              await this.queueService.addBlockchainEvent(fundedJob);
              this.logger.debug(
                `Queued IntentFunded event for intent ${fundedEvent.intentHash} from Solana`,
              );

              break;

            case 'IntentFulfilled':
              const fulfilledEvent = SvmEventParser.parseIntentFulfilledEvent(
                ev.data as IntentFulfilledInstruction,
                logs,
                this.solanaConfigService.chainId,
              );

              // Queue the event for processing
              const fulfilledJob: BlockchainEventJob = {
                eventType: 'IntentFulfilled',
                chainId: this.solanaConfigService.chainId,
                chainType: 'svm',
                contractName: 'portal',
                intentHash: fulfilledEvent.intentHash,
                eventData: fulfilledEvent, // For Solana, we pass the parsed event
                metadata: {
                  txHash: logs.signature || undefined,
                  contractAddress: this.programId.toString(),
                },
              };

              await this.queueService.addBlockchainEvent(fulfilledJob);
              this.logger.debug(
                `Queued IntentFulfilled event for intent ${fulfilledEvent.intentHash} from Solana`,
              );
              break;

            case 'IntentWithdrawn':
              const withdrawnEvent = SvmEventParser.parseIntentWithdrawnFromLogs(
                ev.data as IntentWithdrawnInstruction,
                logs,
                this.solanaConfigService.chainId,
              );

              // Queue the event for processing
              const withdrawnJob: BlockchainEventJob = {
                eventType: 'IntentWithdrawn',
                chainId: this.solanaConfigService.chainId,
                chainType: 'svm',
                contractName: 'portal',
                intentHash: withdrawnEvent.intentHash,
                eventData: withdrawnEvent, // For Solana, we pass the parsed event
                metadata: {
                  txHash: logs.signature || undefined,
                  contractAddress: this.programId.toString(),
                },
              };

              await this.queueService.addBlockchainEvent(withdrawnJob);
              this.logger.debug(
                `Queued IntentWithdrawn event for intent ${withdrawnEvent.intentHash} from Solana`,
              );
              break;

            default:
              this.logger.debug(`Unknown event type: ${ev.name}`, ev);
              break;
          }
        } catch (eventError) {
          this.logger.error(`Error processing ${ev.name} event:`, toError(eventError));
        }
      }
    } catch (error) {
      this.logger.error('Error handling Solana program logs:', toError(error));
    }
  }
}
