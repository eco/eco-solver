import { Injectable } from '@nestjs/common';

import { Chain, createPublicClient, createWalletClient, PublicClient, Transport, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { BasicWallet } from './basic-wallet';

@Injectable()
export class BasicWalletFactory {
  createWallet(
    _publicClient: any, // Will be replaced with fresh client
    transport: Transport,
    chain: Chain,
    privateKey: `0x${string}`,
  ): BasicWallet {
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

    return new BasicWallet(publicClient as PublicClient, walletClient as WalletClient);
  }
}