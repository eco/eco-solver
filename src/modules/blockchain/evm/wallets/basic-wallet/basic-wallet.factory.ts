import { Injectable } from '@nestjs/common';

import { createPublicClient, createWalletClient, Hex, PublicClient, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../../services/evm-transport.service';

import { BasicWallet } from './basic-wallet';

@Injectable()
export class BasicWalletFactory {
  constructor(
    private evmConfigService: EvmConfigService,
    private transportService: EvmTransportService,
  ) {}

  createWallet(chainId: number): IEvmWallet {
    // Get the transport and chain from the transport service
    const transport = this.transportService.getTransport(chainId);
    const chain = this.transportService.getViemChain(chainId);

    // Get the private key - use wallet-specific if provided, otherwise use global
    const privateKey = this.evmConfigService.privateKey as Hex;
    const account = privateKeyToAccount(privateKey);

    // Create the clients
    const publicClient = createPublicClient({
      chain,
      transport,
    });

    const walletClient = createWalletClient({
      account,
      chain,
      transport,
    });

    return new BasicWallet(publicClient as PublicClient, walletClient as WalletClient);
  }
}
