import { Injectable } from '@nestjs/common';

import { BaseTvmWallet } from '@/common/abstractions/base-tvm-wallet.abstract';
import { SystemLoggerService } from '@/modules/logging';

import { BasicWalletFactory } from '../wallets/basic-wallet';

export type TvmWalletType = 'basic'; // Can be extended in the future

@Injectable()
export class TvmWalletManagerService {
  constructor(
    private readonly basicWalletFactory: BasicWalletFactory,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(TvmWalletManagerService.name);
  }

  createWallet(chainId: number | string, walletType: TvmWalletType = 'basic'): BaseTvmWallet {
    this.logger.log(`Creating TVM wallet of type ${walletType} for chain ${chainId}`);

    switch (walletType) {
      case 'basic':
        return this.basicWalletFactory.create(chainId);
      default:
        throw new Error(`Unsupported TVM wallet type: ${walletType}`);
    }
  }

  async getWalletAddress(chainId: number | string, walletType: TvmWalletType = 'basic'): Promise<string> {
    const wallet = this.createWallet(chainId, walletType);
    return wallet.getAddress();
  }
}