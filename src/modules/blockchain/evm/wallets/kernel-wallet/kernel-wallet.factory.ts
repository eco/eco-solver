import { Injectable } from '@nestjs/common';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { KernelWallet } from '@/modules/blockchain/evm/wallets';
import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../../services/evm-transport.service';

@Injectable()
export class KernelWalletFactory {
  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
  ) {}

  createWallet(chainId: number): IEvmWallet {
    return new KernelWallet(
      chainId,
      this.evmConfigService.getKernelWalletConfig(),
      this.transportService,
    );
  }
}
