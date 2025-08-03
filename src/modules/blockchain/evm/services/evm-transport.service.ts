import { Injectable } from '@nestjs/common';

import { Chain, createPublicClient, extractChain, http, Transport, webSocket } from 'viem';
import * as chains from 'viem/chains';

import { EvmConfigService } from '@/modules/config/services';

interface ChainTransport {
  chain: Chain;
  transport: Transport;
}

@Injectable()
export class EvmTransportService {
  private chainTransports: Map<number, ChainTransport> = new Map();
  private allChains: Chain[];

  constructor(private evmConfigService: EvmConfigService) {
    this.allChains = Object.values(chains) as Chain[];
    // Initialize transport for the default configured chain
    this.initializeChainTransport(this.evmConfigService.chainId);
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

    const rpcUrl = this.evmConfigService.rpcUrl;
    const wsUrl = this.evmConfigService.wsUrl;

    // Extract the chain configuration from viem/chains
    const chain = extractChain({
      chains: this.allChains,
      id: chainId,
    });

    // Create transport - prefer WebSocket if available for better performance with event listening
    const transport = wsUrl ? webSocket(wsUrl) : http(rpcUrl);

    this.chainTransports.set(chainId, {
      chain,
      transport,
    });
  }
}
