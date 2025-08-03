import { Injectable } from '@nestjs/common';

import { Chain, createPublicClient, createWalletClient, PublicClient, Transport, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { KernelWallet, KernelWalletConfig } from './kernel-wallet';

@Injectable()
export class KernelWalletFactory {
  createWallet(
    _publicClient: any, // Will be replaced with fresh client
    transport: Transport,
    chain: Chain,
    privateKey: `0x${string}`,
    config: KernelWalletConfig,
  ): KernelWallet {
    const account = privateKeyToAccount(privateKey);
    
    // Create fresh clients with proper typing
    const publicClient = createPublicClient({
      chain,
      transport,
    });
    
    const walletClient = createWalletClient({
      account,
      chain,
      transport,
    });

    return new KernelWallet(publicClient as PublicClient, walletClient as WalletClient, config);
  }
}