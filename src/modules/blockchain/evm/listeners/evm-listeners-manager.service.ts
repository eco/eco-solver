import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

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

class ChainListener extends BaseChainListener {
  private publicClient: any;
  private unsubscribe: any;

  constructor(
    config: EvmChainConfig,
    private transportService: EvmTransportService,
    fulfillmentService: FulfillmentService,
  ) {
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
    console.log(`EVM listener stopped for chain ${this.config.chainId}`);
  }

  onIntent(callback: (intent: Intent) => Promise<void>): void {
    // This is handled by the base class
  }

  protected parseIntentFromEvent(event: any): Intent {
    const { args } = event;
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
      // The base class handles the submission to fulfillment service
      await this.handleIntent(intent);
    } catch (error) {
      console.error('Error handling intent created event:', error);
    }
  }
}

@Injectable()
export class EvmListenersManagerService implements OnModuleInit, OnModuleDestroy {
  private listeners: Map<number, ChainListener> = new Map();

  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
    private fulfillmentService: FulfillmentService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Create and start a listener for each configured network
    for (const network of this.evmConfigService.networks) {
      const config: EvmChainConfig = {
        chainType: 'EVM',
        chainId: network.chainId,
        rpcUrl: network.rpc.urls[0],
        websocketUrl: network.ws?.urls?.[0],
        privateKey: this.evmConfigService.privateKey,
        intentSourceAddress: network.intentSourceAddress,
        inboxAddress: network.inboxAddress,
      };

      const listener = new ChainListener(
        config,
        this.transportService,
        this.fulfillmentService,
      );

      await listener.start();
      this.listeners.set(network.chainId, listener);
    }

    console.log(
      `Started ${this.listeners.size} EVM listeners for chains: ${Array.from(
        this.listeners.keys(),
      ).join(', ')}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    // Stop all listeners
    const stopPromises = Array.from(this.listeners.values()).map((listener) =>
      listener.stop(),
    );
    await Promise.all(stopPromises);
    this.listeners.clear();
  }
}