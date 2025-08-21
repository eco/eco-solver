import { Injectable } from '@nestjs/common';

import { TronWeb } from 'tronweb';

import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

import { TvmTransportService } from '../../services/tvm-transport.service';
import { BasicWallet } from './basic-wallet';

@Injectable()
export class BasicWalletFactory {
  constructor(
    private readonly tvmConfigService: TvmConfigService,
    private readonly tvmTransportService: TvmTransportService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  create(chainId: number | string): BasicWallet {
    const walletConfig = this.tvmConfigService.getBasicWalletConfig();
    
    if (!walletConfig?.privateKey) {
      throw new Error('TVM basic wallet private key not configured');
    }

    // Get TronWeb instance from transport service
    const tronWeb = this.tvmTransportService.getClient(chainId);
    
    // Create a new instance with the private key
    const network = this.tvmConfigService.getChain(chainId);
    const rpc = network.rpc;
    
    const tronWebWithKey = new TronWeb({
      fullNode: rpc.fullNode,
      solidityNode: rpc.solidityNode || rpc.fullNode,
      eventServer: rpc.eventServer || rpc.fullNode,
      privateKey: walletConfig.privateKey,
    });

    return new BasicWallet(tronWebWithKey, this.logger, this.otelService);
  }
}