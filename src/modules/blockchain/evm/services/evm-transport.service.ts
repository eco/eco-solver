import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  Chain,
  createPublicClient,
  extractChain,
  fallback,
  http,
  Transport,
  webSocket,
} from 'viem';
import * as chains from 'viem/chains';

import { EvmRpcSchema, EvmWsSchema } from '@/config/schemas';
import { EvmConfigService } from '@/modules/config/services';

interface ChainTransport {
  chain: Chain;
  transport: Transport;
}

@Injectable()
export class EvmTransportService implements OnModuleInit {
  private chainTransports: Map<number, ChainTransport> = new Map();
  private allChains: Chain[];

  constructor(private evmConfigService: EvmConfigService) {
    this.allChains = Object.values(chains) as Chain[];
  }

  onModuleInit(): void {
    // Initialize transports for all configured chains
    for (const network of this.evmConfigService.networks) {
      this.initializeChainTransport(network.chainId);
    }
  }

  getTransport(chainId: number) {
    this.initializeChainTransport(chainId);
    const chainTransport = this.chainTransports.get(chainId);
    if (!chainTransport) {
      throw new Error(`Transport not initialized for chain ${chainId}`);
    }
    return chainTransport.transport;
  }

  getViemChain(chainId: number) {
    this.initializeChainTransport(chainId);
    const chainTransport = this.chainTransports.get(chainId);
    if (!chainTransport) {
      throw new Error(`Chain not initialized for chain ${chainId}`);
    }
    return chainTransport.chain;
  }

  getPublicClient(chainId: number) {
    const transport = this.getTransport(chainId);
    const chain = this.getViemChain(chainId);

    return createPublicClient({
      chain,
      transport,
    });
  }

  private initializeChainTransport(chainId: number): void {
    if (this.chainTransports.has(chainId)) {
      return;
    }

    const network = this.evmConfigService.getNetwork(chainId);
    if (!network) {
      throw new Error(`No network configuration found for chainId: ${chainId}`);
    }

    // Extract the chain configuration from viem/chains
    const chain = extractChain({
      chains: this.allChains,
      id: chainId,
    });

    // Get transport options
    const rpc = EvmRpcSchema.safeParse(network.rpc);
    const wsOptions = EvmWsSchema.safeParse(network.rpc);

    // Create transport - prefer WebSocket if available for better performance with event listening
    let transport: Transport;
    if (wsOptions.success) {
      const { urls, options } = wsOptions.data;
      if (urls.length > 1) {
        transport = fallback(urls.map((url) => webSocket(url, options)));
      } else {
        transport = webSocket(urls[0], options);
      }
    } else if (rpc.success) {
      const { urls, options } = rpc.data;
      if (urls.length > 1) {
        transport = fallback(urls.map((url) => http(url, options)));
      } else {
        transport = http(urls[0], options);
      }
    }

    this.chainTransports.set(chainId, {
      chain,
      transport,
    });
  }
}
