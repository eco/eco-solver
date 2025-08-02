import { Injectable } from '@nestjs/common';
import { createPublicClient, createWalletClient, http, webSocket, parseAbiItem, Log } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmConfigService } from '@/modules/config/services';

const INTENT_CREATED_EVENT = parseAbiItem(
  'event IntentCreated(bytes32 indexed intentId, address indexed user, address solver, address source, address target, bytes data, uint256 value, uint256 reward, uint256 deadline)'
);

@Injectable()
export class EvmListener extends BaseChainListener {
  private publicClient: any;
  private walletClient: any;
  private unsubscribe: any;
  private intentCallback: (intent: Intent) => Promise<void>;

  constructor(private evmConfigService: EvmConfigService) {
    const config: EvmChainConfig = {
      chainType: 'EVM',
      chainId: evmConfigService.chainId,
      rpcUrl: evmConfigService.rpcUrl,
      websocketUrl: evmConfigService.wsUrl,
      privateKey: evmConfigService.privateKey,
      intentSourceAddress: evmConfigService.intentSourceAddress,
      inboxAddress: evmConfigService.inboxAddress,
    };
    super(config);
  }

  async start(): Promise<void> {
    const evmConfig = this.config as EvmChainConfig;
    
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: evmConfig.websocketUrl 
        ? webSocket(evmConfig.websocketUrl)
        : http(evmConfig.rpcUrl),
    });

    const account = privateKeyToAccount(evmConfig.privateKey as `0x${string}`);
    
    this.walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(evmConfig.rpcUrl),
    });

    this.unsubscribe = await this.publicClient.watchEvent({
      address: evmConfig.intentSourceAddress as `0x${string}`,
      event: INTENT_CREATED_EVENT,
      onLogs: (logs: Log[]) => {
        logs.forEach(log => this.handleIntentCreatedEvent(log));
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
      sourceChainId: evmConfig.chainId,
      targetChainId: evmConfig.chainId, // Assuming same chain for now
      solver: args.solver,
      user: args.user,
      source: args.source,
      target: args.target,
      data: args.data,
      value: args.value.toString(),
      reward: args.reward.toString(),
      deadline: Number(args.deadline),
      timestamp: Math.floor(Date.now() / 1000),
      status: IntentStatus.PENDING,
      txHash: transactionHash,
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