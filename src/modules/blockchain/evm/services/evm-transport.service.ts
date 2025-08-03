import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  Chain,
  createPublicClient,
  extractChain,
  http,
  HttpTransportConfig,
  Transport,
  webSocket,
  WebSocketTransportConfig,
} from 'viem';
import * as chains from 'viem/chains';

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
    const rpcOptions = network.rpc.options;
    const wsOptions = network.ws?.options;

    // Create transport - prefer WebSocket if available for better performance with event listening
    let transport: Transport;
    if (network.ws?.urls && network.ws.urls.length > 0) {
      const wsConfig: WebSocketTransportConfig = {
        key: 'webSocket',
        name: 'WebSocket JSON-RPC',
      };

      // Apply WebSocket options if provided
      if (wsOptions) {
        if (wsOptions.timeout !== undefined) {
          wsConfig.timeout = wsOptions.timeout;
        }
        // Note: keepAlive and reconnect options would need custom handling
        // as Viem's webSocket transport doesn't directly support them
      }

      transport = webSocket(network.ws.urls[0], wsConfig);
    } else {
      const httpConfig: HttpTransportConfig = {};

      // Apply HTTP options if provided
      if (rpcOptions) {
        if (rpcOptions.batch !== undefined) {
          httpConfig.batch = rpcOptions.batch;
        }
        if (rpcOptions.timeout !== undefined) {
          httpConfig.timeout = rpcOptions.timeout;
        }
        if (rpcOptions.retryCount !== undefined) {
          httpConfig.retryCount = rpcOptions.retryCount;
        }
        if (rpcOptions.retryDelay !== undefined) {
          httpConfig.retryDelay = rpcOptions.retryDelay;
        }
      }

      transport = http(network.rpc.urls[0], httpConfig);
    }

    this.chainTransports.set(chainId, {
      chain,
      transport,
    });
  }
}
