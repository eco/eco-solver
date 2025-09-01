import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Connection, Keypair, PublicKey } from '@solana/web3.js';

// Route type now comes from intent.interface.ts
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import {
  BlockchainConfigService,
  FulfillmentConfigService,
  SolanaConfigService,
} from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

@Injectable()
export class SolanaListener extends BaseChainListener {
  private connection: Connection;
  private programId: PublicKey;
  private subscriptionId: number;
  private keypair: Keypair;

  constructor(
    private solanaConfigService: SolanaConfigService,
    private eventEmitter: EventEmitter2,
    private fulfillmentConfigService: FulfillmentConfigService,
    private readonly logger: SystemLoggerService,
    private readonly blockchainConfigService: BlockchainConfigService,
  ) {
    super();
    this.logger.setContext(SolanaListener.name);
  }

  async start(): Promise<void> {
    this.connection = new Connection(this.solanaConfigService.rpcUrl, {
      wsEndpoint: this.solanaConfigService.wsUrl,
      commitment: 'confirmed',
    });

    // Get Portal program ID from config service
    const chainId = this.solanaConfigService.chainId || 'solana-mainnet';
    const portalProgramId = this.blockchainConfigService.getPortalAddress(chainId);
    this.programId = new PublicKey(portalProgramId);
    this.keypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(this.solanaConfigService.secretKey)),
    );

    this.subscriptionId = this.connection.onLogs(
      this.programId,
      (logs) => this.handleProgramLogs(logs),
      'confirmed',
    );

    this.logger.log(`Solana listener started for Portal program ${this.programId.toString()}`);
  }

  async stop(): Promise<void> {
    if (this.subscriptionId && this.connection) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
    }
    this.logger.log('Solana listener stopped');
  }

  protected parseIntentFromEvent(event: any): Intent {
    // Parse Solana Portal program logs to extract intent data
    const intentData = this.parseIntentFromLogs(event.logs);

    // Decode route based on destination chain type - already returns Intent format
    const destChainType = ChainTypeDetector.detect(BigInt(intentData.destination));
    const route = PortalEncoder.decodeFromChain(
      Buffer.from(intentData.route, 'hex'),
      destChainType,
      'route',
    );

    return {
      intentHash: intentData.intentHash,
      destination: BigInt(intentData.destination),
      route, // Already in Intent format with UniversalAddress from PortalEncoder
      reward: {
        deadline: BigInt(intentData.rewardDeadline),
        creator: AddressNormalizer.normalize(intentData.creator, ChainType.SVM),
        prover: AddressNormalizer.normalize(intentData.prover, ChainType.SVM),
        nativeAmount: BigInt(intentData.rewardNativeAmount || 0),
        tokens: (intentData.rewardTokens || []).map((token) => ({
          amount: token.amount,
          token: AddressNormalizer.normalize(token.token, ChainType.SVM),
        })),
      },
      sourceChainId: BigInt('999999999'), // Solana chain ID placeholder
      status: IntentStatus.PENDING,
    };
  }

  private async handleProgramLogs(logs: any) {
    try {
      if (this.isIntentPublishedLog(logs)) {
        const intent = this.parseIntentFromEvent(logs);
        const defaultStrategy = this.fulfillmentConfigService.defaultStrategy;
        this.eventEmitter.emit('intent.discovered', { intent, strategy: defaultStrategy });
      }
    } catch (error) {
      this.logger.error('Error handling Solana program logs:', error);
    }
  }

  private isIntentPublishedLog(logs: any): boolean {
    return logs.logs.some(
      (log: string) => log.includes('IntentPublished') || log.includes('intent_published'),
    );
  }

  private parseIntentFromLogs(logs: string[]): any {
    // Parse logs to extract intent data
    // This is a placeholder - actual implementation depends on program log format
    const intentData: any = {};

    logs.forEach((log) => {
      if (log.includes('intentHash:')) {
        intentData.intentHash = log.split('intentHash:')[1].trim();
      }
      // Parse other fields similarly
    });

    return {
      intentHash: intentData.intentHash || '',
      destination: intentData.destination || '',
      route: intentData.route || '',
      creator: intentData.creator || '',
      prover: intentData.prover || '',
      rewardDeadline: intentData.rewardDeadline || 0,
      rewardNativeAmount: intentData.rewardNativeAmount || '0',
      rewardTokens: intentData.rewardTokens || [],
    };
  }
}
