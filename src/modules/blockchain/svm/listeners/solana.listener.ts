import { Injectable } from '@nestjs/common';

import { BorshCoder, EventParser, Idl } from '@coral-xyz/anchor';
import { Connection, Logs, PublicKey } from '@solana/web3.js';
import { Hex } from 'viem';

import * as portalIdl from '@/common/abis/portal.json';
// Route type now comes from intent.interface.ts
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { toError } from '@/common/utils/error-handler';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import {
  BlockchainConfigService,
  FulfillmentConfigService,
  SolanaConfigService,
} from '@/modules/config/services';
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
    private fulfillmentConfigService: FulfillmentConfigService,
    private readonly logger: SystemLoggerService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {
    super();
    this.logger.setContext(SolanaListener.name);

    const coder = new BorshCoder(portalIdl as Idl);
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
      (logs: Logs) => this.handleProgramLogs(logs),
      'confirmed',
    );

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

  protected parseIntentFromEvent(ev: any, signature: string): Intent {
    const {
      intent_hash, // Uint8Array(32)
      destination, // anchor.BN
      route, // Uint8Array
      reward, // Reward struct from IDL
    } = ev.data;

    // Convert intent hash to hex string
    const intentHash = `0x${Buffer.from(intent_hash[0]).toString('hex')}` as Hex;

    // Print out route data for debugging
    console.log('Route data from Solana event:', {
      routeLength: route.length,
      routeHex: Buffer.from(route).toString('hex'),
      routeBuffer: Buffer.from(route),
      destination: destination.toString(),
    });

    // Decode route based on destination chain type
    const destChainType = ChainTypeDetector.detect(BigInt(destination.toString()));

    const decodedRoute = PortalEncoder.decodeFromChain(Buffer.from(route), destChainType, 'route');

    return {
      intentHash,
      destination: BigInt(destination.toString()),
      route: decodedRoute,
      reward: {
        deadline: BigInt(reward.deadline.toString()),
        creator: AddressNormalizer.normalize(reward.creator.toString(), ChainType.SVM),
        prover: AddressNormalizer.normalize(reward.prover.toString(), ChainType.SVM),
        nativeAmount: BigInt(reward.native_amount.toString()),
        tokens: reward.tokens.map((token: any) => ({
          amount: BigInt(token.amount.toString()),
          token: AddressNormalizer.normalize(token.token.toString(), ChainType.SVM),
        })),
      },
      sourceChainId: BigInt('1399811149'), // Solana chainId
      status: IntentStatus.PENDING,
      publishTxHash: signature,
    };
  }

  private parseIntentFundedFromLogs(ev: any, _signature: string): any {
    // Parse logs to extract IntentFunded event data
    this.logger.log('SOYLANA parseIntentFundedFromLogs', ev);
  }

  private async handleProgramLogs(logs: Logs): Promise<void> {
    try {
      for (const ev of this.parser.parseLogs(logs.logs)) {
        try {
          switch (ev.name) {
            case 'IntentPublished':
              const intent = this.parseIntentFromEvent(ev, logs.signature || '');
              const defaultStrategy = this.fulfillmentConfigService.defaultStrategy;
              this.eventsService.emit('intent.discovered', { intent, strategy: defaultStrategy });
              this.logger.log(`IntentPublished event processed: ${intent.intentHash} on Solana`);
              break;

            case 'IntentFunded':
              const fundedEvent = this.parseIntentFundedFromLogs(ev, logs.signature || '');
              // this.eventsService.emit('intent.funded', fundedEvent);
              this.logger.log(`IntentFunded event processed: ${fundedEvent.intentHash} on Solana`);
              break;

            case 'IntentFulfilled':
              const fulfilledEvent = this.parseIntentFulfilledFromLogs(logs);
              this.eventsService.emit('intent.fulfilled', fulfilledEvent);
              this.logger.log(
                `IntentFulfilled event processed: ${fulfilledEvent.intentHash} on Solana`,
              );
              break;

            case 'IntentProven':
              const provenEvent = this.parseIntentProvenFromLogs(logs);
              this.eventsService.emit('intent.proven', provenEvent);
              this.logger.log(`IntentProven event processed: ${provenEvent.intentHash} on Solana`);
              break;

            case 'IntentWithdrawn':
              const withdrawnEvent = this.parseIntentWithdrawnFromLogs(logs);
              this.eventsService.emit('intent.withdrawn', withdrawnEvent);
              this.logger.log(
                `IntentWithdrawn event processed: ${withdrawnEvent.intentHash} on Solana`,
              );
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

  private parseIntentFulfilledFromLogs(logs: Logs): any {
    // Parse logs to extract IntentFulfilled event data
    const eventData: any = {};

    logs.logs.forEach((log: string) => {
      if (log.includes('intentHash:')) {
        eventData.intentHash = log.split('intentHash:')[1].trim();
      }
      if (log.includes('claimant:')) {
        eventData.claimant = log.split('claimant:')[1].trim();
      }
    });

    const chainId = BigInt(999999999); // Solana chain ID placeholder
    const claimant = AddressNormalizer.normalize(eventData.claimant || '', ChainType.SVM);

    return {
      intentHash: (eventData.intentHash || '') as Hex,
      claimant,
      txHash: logs.signature,
      blockNumber: BigInt(0), // Solana doesn't use block numbers in the same way
      timestamp: new Date(),
      chainId,
    };
  }

  private parseIntentProvenFromLogs(logs: Logs): any {
    // Parse logs to extract IntentProven event data
    const eventData: any = {};

    logs.logs.forEach((log: string) => {
      if (log.includes('intentHash:')) {
        eventData.intentHash = log.split('intentHash:')[1].trim();
      }
      if (log.includes('claimant:')) {
        eventData.claimant = log.split('claimant:')[1].trim();
      }
    });

    const chainId = BigInt(999999999); // Solana chain ID placeholder
    const claimant = AddressNormalizer.normalize(eventData.claimant || '', ChainType.SVM);

    return {
      intentHash: (eventData.intentHash || '') as Hex,
      claimant,
      txHash: logs.signature,
      blockNumber: BigInt(0), // Solana doesn't use block numbers in the same way
      timestamp: new Date(),
      chainId,
    };
  }

  private parseIntentWithdrawnFromLogs(logs: Logs): any {
    // Parse logs to extract IntentWithdrawn event data
    const eventData: any = {};

    logs.logs.forEach((log: string) => {
      if (log.includes('intentHash:')) {
        eventData.intentHash = log.split('intentHash:')[1].trim();
      }
      if (log.includes('claimant:')) {
        eventData.claimant = log.split('claimant:')[1].trim();
      }
    });

    const chainId = BigInt(999999999); // Solana chain ID placeholder
    const claimant = AddressNormalizer.normalize(eventData.claimant || '', ChainType.SVM);

    return {
      intentHash: (eventData.intentHash || '') as Hex,
      claimant,
      txHash: logs.signature,
      blockNumber: BigInt(0), // Solana doesn't use block numbers in the same way
      timestamp: new Date(),
      chainId,
    };
  }
}
