import { Address } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { IFulfillmentStrategy } from '@/modules/fulfillment/interfaces/fulfillment-strategy.interface';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';

/**
 * Immutable implementation of ValidationContext
 * Thread-safe since all properties are readonly and set via constructor
 */
export class ValidationContextImpl implements ValidationContext {
  constructor(
    private readonly intent: Intent,
    private readonly strategy: IFulfillmentStrategy,
    private readonly blockchainExecutor: BlockchainExecutorService,
    private readonly blockchainReader: BlockchainReaderService,
  ) {}

  async getWalletId(): Promise<string> {
    return this.strategy.getWalletIdForIntent(this.intent);
  }

  async getWalletAddress(chainId: bigint): Promise<Address> {
    const walletId = await this.getWalletId();
    const executor = await this.blockchainExecutor.getExecutorForChain(chainId);
    return executor.getWalletAddress(walletId as WalletType, chainId);
  }

  async getWalletBalance(chainId: bigint, tokenAddress?: Address): Promise<bigint> {
    const walletAddress = await this.getWalletAddress(chainId);
    const reader = await this.blockchainReader.getReaderForChain(chainId);

    if (tokenAddress) {
      return reader.getTokenBalance(tokenAddress, walletAddress, Number(chainId));
    }
    return reader.getBalance(walletAddress);
  }
}
