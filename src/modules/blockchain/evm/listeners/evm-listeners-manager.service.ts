import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EvmChainConfig } from '@/common/interfaces/chain-config.interface';
import { EvmConfigService } from '@/modules/config/services';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

import { EvmTransportService } from '../services/evm-transport.service';
import { ChainListener } from '@/modules/blockchain/evm/listeners/chain.listener';
import { Address } from 'viem';

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
        inboxAddress: network.inboxAddress as Address,
        intentSourceAddress: network.intentSourceAddress as Address,
      };

      const listener = new ChainListener(config, this.transportService, this.fulfillmentService);

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
    const stopPromises = Array.from(this.listeners.values()).map((listener) => listener.stop());
    await Promise.all(stopPromises);
    this.listeners.clear();
  }
}
