import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ITvmWallet } from '@/common/interfaces/tvm-wallet.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';

import { BasicWalletFactory } from '../wallets/basic-wallet';

export type TvmWalletType = 'basic'; // Can be extended in the future

@Injectable()
export class TvmWalletManagerService {
  constructor(
    @InjectPinoLogger(TvmWalletManagerService.name)
    private readonly logger: PinoLogger,
    private readonly basicWalletFactory: BasicWalletFactory,
  ) {}

  /**
   * Creates a wallet instance for the specified chain and type
   * @param chainId - The chain ID to create wallet for
   * @param walletType - The type of wallet to create (default: 'basic')
   * @returns A wallet instance
   * @throws Error if wallet type is not supported
   */
  createWallet(chainId: number | string, walletType: TvmWalletType): ITvmWallet {
    this.logger.info(`Creating TVM wallet of type ${walletType} for chain ${chainId}`);

    switch (walletType) {
      case 'basic':
        return this.basicWalletFactory.create(chainId);
      default:
        throw new Error(`Unsupported TVM wallet type: ${walletType}`);
    }
  }

  /**
   * Gets the address for a specific wallet type
   * @param chainId - The chain ID
   * @param walletType - The type of wallet (default: 'basic')
   * @returns The wallet address in base58 format
   */
  async getWalletAddress(
    chainId: number | string,
    walletType: TvmWalletType = 'basic',
  ): Promise<UniversalAddress> {
    const wallet = this.createWallet(chainId, walletType);
    return AddressNormalizer.normalizeTvm(await wallet.getAddress());
  }
}
