import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  Chain,
  createPublicClient,
  extractChain,
  fallback,
  http,
  PublicClient,
  Transport,
  webSocket,
} from 'viem';
import * as chains from 'viem/chains';

import { EvmRpcSchema, EvmWsSchema } from '@/config/schemas/evm.schema';
import { EvmConfigService } from '@/modules/config/services';

interface ChainTransport {
  chain: Chain;
  transport: Transport;
  pollingTransport?: Transport;
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

  getPollingPublicClient(chainId: number): PublicClient | undefined {
    this.initializeChainTransport(chainId);
    const chainTransport = this.chainTransports.get(chainId);
    if (!chainTransport || !chainTransport.pollingTransport) {
      return undefined;
    }

    return createPublicClient({
      chain: chainTransport.chain,
      transport: chainTransport.pollingTransport,
    });
  }

  hasPollingTransport(chainId: number): boolean {
    this.initializeChainTransport(chainId);
    const chainTransport = this.chainTransports.get(chainId);
    return !!chainTransport?.pollingTransport;
  }

  private initializeChainTransport(chainId: number): void {
    if (this.chainTransports.has(chainId)) {
      return;
    }

    const network = this.evmConfigService.getChain(chainId);

    // Extract the chain configuration from viem/chains
    const chain = extractChain({
      chains: this.allChains,
      id: chainId,
    });

    // Get transport options
    const rpc = EvmRpcSchema.safeParse(network.rpc);
    const wsOptions = EvmWsSchema.safeParse(network.rpc);

    let transport: Transport;
    let pollingTransport: Transport | undefined;

    if (wsOptions.success) {
      // WebSocket configuration
      const { urls, options } = wsOptions.data;

      // Create WebSocket transport
      const wsTransports = urls.map((url) => webSocket(url, options));
      transport = wsTransports.length > 1 ? fallback(wsTransports) : wsTransports[0];

      // Get HTTP configuration from config service (handles defaults)
      const httpRpcConfig = this.evmConfigService.getHttpConfigForWebSocket(network);
      if (httpRpcConfig) {
        const httpTransports = httpRpcConfig.urls.map((url) => http(url, httpRpcConfig.options));
        pollingTransport = httpTransports.length > 1 ? fallback(httpTransports) : httpTransports[0];
      }
    } else if (rpc.success) {
      // HTTP-only configuration
      const { urls, options } = rpc.data;
      const httpTransports = urls.map((url) => http(url, options));
      transport = httpTransports.length > 1 ? fallback(httpTransports) : httpTransports[0];
      // No polling transport for HTTP-only configuration
    } else {
      throw new Error(`No valid RPC or WebSocket configuration found for chain ${chainId}`);
    }

    this.chainTransports.set(chainId, {
      chain,
      transport,
      pollingTransport,
    });
  }
}
