import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { IntentSourceAbi } from '@eco-foundation/routes-ts';
import { PublicClient } from 'viem';

import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';

export class ChainListener extends BaseChainListener {
  private unsubscribe: ReturnType<PublicClient['watchContractEvent']>;
  private logger: Logger;

  constructor(
    private readonly config: EvmChainConfig,
    private readonly transportService: EvmTransportService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
    this.logger = new Logger(`${ChainListener.name}:${config.chainId}`);
  }

  async start(): Promise<void> {
    const evmConfig = this.config as EvmChainConfig;

    const publicClient = this.transportService.getPublicClient(evmConfig.chainId);

    this.logger.log(
      `Listening for IntentCreated events, intent source: ${evmConfig.intentSourceAddress}`,
    );

    this.unsubscribe = publicClient.watchContractEvent({
      abi: IntentSourceAbi,
      eventName: 'IntentCreated',
      address: evmConfig.intentSourceAddress,
      strict: true,
      onLogs: (logs) => {
        logs.forEach((log) => {
          const intent = {
            intentHash: log.args.hash,
            reward: {
              prover: log.args.prover,
              creator: log.args.creator,
              deadline: log.args.deadline,
              nativeValue: log.args.nativeValue,
              tokens: log.args.rewardTokens,
            },
            route: {
              source: log.args.source,
              destination: log.args.destination,
              salt: log.args.salt,
              inbox: log.args.inbox,
              calls: log.args.calls,
              tokens: log.args.routeTokens,
            },
          };

          this.eventEmitter.emit('intent.discovered', { intent, strategy: 'standard' });
        });
      },
    });
  }

  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.logger.warn(`EVM listener stopped for chain ${this.config.chainId}`);
  }
}
