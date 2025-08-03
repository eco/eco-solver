import { Injectable } from '@nestjs/common';

import { Log, parseAbiItem } from 'viem';

import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

import { EvmTransportService } from '../services/evm-transport.service';

const INTENT_CREATED_EVENT = parseAbiItem(
  'event IntentCreated(bytes32 indexed intentId, address indexed user, address solver, address source, address target, bytes data, uint256 value, uint256 reward, uint256 deadline)',
);

@Injectable()
export class EvmListener extends BaseChainListener {
  private publicClient: any;
  private unsubscribe: any;
  private intentCallback: (intent: Intent) => Promise<void>;

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    fulfillmentService: FulfillmentService,
  ) {
    const config: EvmChainConfig = {
      chainType: 'EVM',
      chainId: evmConfigService.chainId,
      rpcUrl: evmConfigService.rpcUrl,
      websocketUrl: evmConfigService.wsUrl,
      privateKey: evmConfigService.privateKey,
      intentSourceAddress: evmConfigService.intentSourceAddress,
      inboxAddress: evmConfigService.inboxAddress,
    };
    super(config, fulfillmentService);
  }

  async start(): Promise<void> {
    const evmConfig = this.config as EvmChainConfig;

    this.publicClient = this.transportService.getPublicClient(evmConfig.chainId);

    this.unsubscribe = await this.publicClient.watchEvent({
      address: evmConfig.intentSourceAddress as `0x${string}`,
      event: INTENT_CREATED_EVENT,
      onLogs: (logs: Log[]) => {
        logs.forEach((log) => this.handleIntentCreatedEvent(log));
      },
    });

    console.log(`EVM listener started for chain ${evmConfig.chainId}`);
  }

  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    console.log('EVM listener stopped');
  }

  onIntent(callback: (intent: Intent) => Promise<void>): void {
    this.intentCallback = callback;
  }

  protected parseIntentFromEvent(event: any): Intent {
    const { args, transactionHash } = event;
    const evmConfig = this.config as EvmChainConfig;

    return {
      intentId: args.intentId,
      reward: {
        prover: args.prover || (args.solver as `0x${string}`),
        creator: args.creator || (args.user as `0x${string}`),
        deadline: BigInt(args.deadline || 0),
        nativeValue: BigInt(args.reward || 0),
        tokens: [], // TODO: Parse token rewards if any
      },
      route: {
        source: BigInt(evmConfig.chainId),
        destination: BigInt(args.targetChainId || evmConfig.chainId),
        salt: (args.salt || '0x0') as `0x${string}`,
        inbox: args.inbox || (args.target as `0x${string}`),
        calls: [
          {
            data: (args.data || '0x') as `0x${string}`,
            target: args.target as `0x${string}`,
            value: BigInt(args.value || 0),
          },
        ],
        tokens: [], // TODO: Parse route tokens if any
      },
      status: IntentStatus.PENDING,
    };
  }

  private async handleIntentCreatedEvent(log: Log) {
    try {
      const intent = this.parseIntentFromEvent(log);
      if (this.intentCallback) {
        await this.intentCallback(intent);
      }
    } catch (error) {
      console.error('Error handling intent created event:', error);
    }
  }
}
