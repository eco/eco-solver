import { Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { TronWeb } from 'tronweb';

import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

interface TronWebConfig {
  fullNode: string;
  solidityNode?: string;
  eventServer?: string;
  privateKey?: string;
}

@Injectable()
export class TvmTransportService implements OnModuleInit {
  private clients: Map<string | number, TronWeb> = new Map();

  constructor(
    private tvmConfigService: TvmConfigService,
    private readonly logger: SystemLoggerService,
    @Optional() private readonly otelService?: OpenTelemetryService,
  ) {
    this.logger.setContext(TvmTransportService.name);
  }

  onModuleInit(): void {
    // Initialize clients for all configured chains
    for (const network of this.tvmConfigService.networks) {
      this.initializeClient(network.chainId);
    }
  }

  getClient(chainId: number | string): TronWeb {
    if (!this.clients.has(chainId)) {
      this.initializeClient(chainId);
    }

    const client = this.clients.get(chainId);
    if (!client) {
      throw new Error(`TronWeb client not initialized for chain ${chainId}`);
    }
    return client;
  }

  private initializeClient(chainId: number | string): void {
    if (this.clients.has(chainId)) {
      return;
    }

    const span = this.otelService?.startSpan('tvm.transport.initializeClient', {
      attributes: {
        'tvm.chain_id': chainId.toString(),
      },
    });

    try {
      const network = this.tvmConfigService.getChain(chainId);
      const rpc = network.rpc;
      const walletConfig = this.tvmConfigService.getBasicWalletConfig();

      const config: TronWebConfig = {
        fullNode: rpc.fullNode,
        solidityNode: rpc.solidityNode || rpc.fullNode,
        eventServer: rpc.eventServer || rpc.fullNode,
      };

      // Add private key if available (for transaction signing)
      if (walletConfig?.privateKey) {
        config.privateKey = walletConfig.privateKey;
      }

      const tronWeb = new TronWeb(config);

      this.clients.set(chainId, tronWeb);
      this.logger.log(`Initialized TronWeb client for chain ${chainId}`);

      span?.setStatus({ code: 0 }); // OK
    } catch (error) {
      span?.recordException(error as Error);
      span?.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span?.end();
    }
  }

  isValidAddress(address: string): boolean {
    const span = this.otelService?.startSpan('tvm.transport.isValidAddress', {
      attributes: {
        'tvm.address': address,
      },
    });

    try {
      const result = TronWeb.isAddress(address);
      span?.setStatus({ code: 0 }); // OK
      return result;
    } catch (error) {
      span?.recordException(error as Error);
      span?.setStatus({ code: 2, message: error.message }); // ERROR
      return false;
    } finally {
      span?.end();
    }
  }

  toHex(address: string): string {
    return TronWeb.address.toHex(address);
  }

  fromHex(hexAddress: string): string {
    return TronWeb.address.fromHex(hexAddress);
  }
}