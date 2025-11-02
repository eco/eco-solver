import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { TvmConfigService } from '@/modules/config/services';
import { OpenTelemetryService } from '@/modules/opentelemetry';

import { TvmClientUtils } from '../../utils';

import { BasicWallet } from './basic-wallet';

@Injectable()
export class BasicWalletFactory {
  constructor(
    @InjectPinoLogger(BasicWalletFactory.name)
    private readonly logger: PinoLogger,
    private readonly tvmConfigService: TvmConfigService,
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

    // Create a new instance with the private key
    const network = this.tvmConfigService.getChain(chainId);
    const tronWebWithKey = TvmClientUtils.createClient(network, walletConfig.privateKey);

    const transactionSettings = this.tvmConfigService.getTransactionSettings();
    return new BasicWallet(tronWebWithKey, transactionSettings, this.logger, this.otelService);
  }
}
