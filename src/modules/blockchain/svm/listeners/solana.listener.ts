import { Injectable } from '@nestjs/common';

import { Connection, Keypair, PublicKey } from '@solana/web3.js';

import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { SolanaChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { SolanaConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

@Injectable()
export class SolanaListener extends BaseChainListener {
  private connection: Connection;
  private programId: PublicKey;
  private subscriptionId: number;
  private intentCallback: (intent: Intent) => Promise<void>;
  private keypair: Keypair;

  constructor(
    private solanaConfigService: SolanaConfigService,
    fulfillmentService: FulfillmentService,
  ) {
    const config: SolanaChainConfig = {
      chainType: 'SVM',
      chainId: 'solana-mainnet',
      rpcUrl: solanaConfigService.rpcUrl,
      websocketUrl: solanaConfigService.wsUrl,
      secretKey: JSON.parse(solanaConfigService.secretKey),
      programId: solanaConfigService.programId,
    };
    super(config, fulfillmentService);
  }

  async start(): Promise<void> {
    const solanaConfig = this.config as SolanaChainConfig;

    this.connection = new Connection(solanaConfig.rpcUrl, {
      wsEndpoint: solanaConfig.websocketUrl,
      commitment: 'confirmed',
    });

    this.programId = new PublicKey(solanaConfig.programId);
    this.keypair = Keypair.fromSecretKey(Uint8Array.from(solanaConfig.secretKey));

    this.subscriptionId = this.connection.onLogs(
      this.programId,
      (logs) => this.handleProgramLogs(logs),
      'confirmed',
    );

    console.log(`Solana listener started for program ${solanaConfig.programId}`);
  }

  async stop(): Promise<void> {
    if (this.subscriptionId) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
    }
    console.log('Solana listener stopped');
  }

  onIntent(callback: (intent: Intent) => Promise<void>): void {
    this.intentCallback = callback;
  }

  protected parseIntentFromEvent(event: any): Intent {
    // Parse Solana program logs to extract intent data
    // This is a simplified example - actual implementation would depend on program structure
    const intentData = this.parseIntentFromLogs(event.logs);

    return {
      intentHash: intentData.intentId,
      reward: {
        prover: intentData.prover as `0x${string}`,
        creator: intentData.creator as `0x${string}`,
        deadline: BigInt(intentData.deadline || 0),
        nativeValue: BigInt(intentData.reward || 0),
        tokens: [],
      },
      route: {
        source: BigInt('999999999'), // Solana chain ID placeholder
        destination: BigInt(intentData.targetChainId || '999999999'),
        salt: '0x' as `0x${string}`,
        inbox: intentData.target as `0x${string}`,
        calls: [{
          data: (intentData.data || '0x') as `0x${string}`,
          target: intentData.target as `0x${string}`,
          value: BigInt(intentData.value || 0),
        }],
        tokens: [],
      },
      status: IntentStatus.PENDING,
    };
  }

  private async handleProgramLogs(logs: any) {
    try {
      if (this.isIntentCreatedLog(logs)) {
        const intent = this.parseIntentFromEvent(logs);
        if (this.intentCallback) {
          await this.intentCallback(intent);
        }
      }
    } catch (error) {
      console.error('Error handling Solana program logs:', error);
    }
  }

  private isIntentCreatedLog(logs: any): boolean {
    return logs.logs.some(
      (log: string) => log.includes('IntentCreated') || log.includes('intent_created'),
    );
  }

  private parseIntentFromLogs(logs: string[]): any {
    // Parse logs to extract intent data
    // This is a placeholder - actual implementation depends on program log format
    const intentData: any = {};

    logs.forEach((log) => {
      if (log.includes('intentId:')) {
        intentData.intentId = log.split('intentId:')[1].trim();
      }
      // Parse other fields similarly
    });

    return {
      intentId: intentData.intentId || '',
      prover: intentData.prover || '',
      creator: intentData.creator || '',
      source: intentData.source || '',
      target: intentData.target || '',
      data: intentData.data || '0x',
      value: intentData.value || '0',
      reward: intentData.reward || '0',
      deadline: intentData.deadline || 0,
      targetChainId: intentData.targetChainId,
    };
  }
}
