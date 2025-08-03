import { IntentSourceAbi } from '@eco-foundation/routes-ts';
import { PublicClient } from 'viem';

import { BaseChainListener } from '@/common/abstractions/base-chain-listener.abstract';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { FULFILLMENT_STRATEGY_NAMES } from '@/modules/fulfillment/types/strategy-name.type';

export class ChainListener extends BaseChainListener {
  private unsubscribe: ReturnType<PublicClient['watchContractEvent']>;

  constructor(
    private readonly config: EvmChainConfig,
    private readonly transportService: EvmTransportService,
    private readonly fulfillmentService: FulfillmentService,
  ) {
    super();
  }

  async start(): Promise<void> {
    const evmConfig = this.config as EvmChainConfig;

    const publicClient = this.transportService.getPublicClient(evmConfig.chainId);

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

          this.fulfillmentService.processIntent(intent, FULFILLMENT_STRATEGY_NAMES.STANDARD);
        });
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
}
