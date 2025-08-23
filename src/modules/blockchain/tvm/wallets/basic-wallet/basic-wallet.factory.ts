import { Injectable } from '@nestjs/common';

import { TronWeb } from 'tronweb';

import { TvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

import { TvmClientUtils } from '../../utils';
import { BasicWallet } from './basic-wallet';

@Injectable()
export class BasicWalletFactory {
  constructor(
    private readonly tvmConfigService: TvmConfigService,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  /**
   * Creates a new BasicWallet instance for the specified chain
   * @param chainId - The chain ID to create wallet for
   * @returns A configured BasicWallet instance
   * @throws Error if private key is not configured
   */
  create(chainId: number | string): BasicWallet {
    const walletConfig = this.tvmConfigService.getBasicWalletConfig();

    if (!walletConfig?.privateKey) {
      throw new Error('TVM basic wallet private key not configured');
    }

    // Create a new instance with the private key
    const network = this.tvmConfigService.getChain(chainId);
    const tronWebWithKey = TvmClientUtils.createClient(network, walletConfig.privateKey);

    const transactionSettings = this.tvmConfigService.getTransactionSettings();
    return new BasicWallet(tronWebWithKey, transactionSettings, this.logger, this.otelService);
  }
}
