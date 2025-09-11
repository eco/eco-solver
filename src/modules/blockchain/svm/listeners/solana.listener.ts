import { Injectable } from '@nestjs/common';

import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import { Connection, Logs, PublicKey } from '@solana/web3.js';

// Route type now comes from intent.interface.ts
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { toError } from '@/common/utils/error-handler';
import { portalIdl } from '@/modules/blockchain/svm/targets/idl/portal.idl';
import {
  IntentFulfilledInstruction,
  IntentPublishedInstruction,
  IntentWithdrawnInstruction,
} from '@/modules/blockchain/svm/targets/types/portal-idl.type';
import { SvmEventParser } from '@/modules/blockchain/svm/utils/svm-event-parser';
import { SolanaConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';

@Injectable()
export class SolanaListener extends BaseChainListener {
  private connection: Connection;
  private programId: PublicKey;
  private subscriptionId: number;
  private parser: EventParser;

  constructor(
    private solanaConfigService: SolanaConfigService,
    private eventsService: EventsService,
    private readonly logger: SystemLoggerService,
  ) {
    super();
    this.logger.setContext(SolanaListener.name);

    const coder = new BorshCoder(portalIdl);
    this.parser = new EventParser(new PublicKey(this.solanaConfigService.portalProgramId), coder);
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
        try {
          switch (ev.name) {
            case 'IntentPublished':
              const intent = SvmEventParser.parseIntentPublishEvent(
                ev.data as IntentPublishedInstruction,
                logs,
                this.solanaConfigService.chainId,
              );
              this.eventsService.emit('intent.discovered', { intent });
              break;

            case 'IntentFulfilled':
              const fulfilledEvent = SvmEventParser.parseIntentFulfilledEvent(
                ev.data as IntentFulfilledInstruction,
                logs,
                this.solanaConfigService.chainId,
              );
              this.eventsService.emit('intent.fulfilled', fulfilledEvent);
              break;

            case 'IntentWithdrawn':
              const withdrawnEvent = SvmEventParser.parseIntentWithdrawnFromLogs(
                ev.data as IntentWithdrawnInstruction,
                logs,
                this.solanaConfigService.chainId,
              );
              this.eventsService.emit('intent.withdrawn', withdrawnEvent);
              break;

            default:
              this.logger.debug(`Unknown event type: ${ev.name}`, ev);
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
