import { Logger } from '@nestjs/common';

import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';

export abstract class BaseChainReader {
  protected abstract readonly logger: Logger;

  abstract getBalance(address: string, chainId?: number | string): Promise<bigint>;

  abstract getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
    chainId?: number | string,
  ): Promise<bigint>;

  abstract isAddressValid(address: string): boolean;

  abstract isIntentFunded(intent: Intent, chainId?: number | string): Promise<boolean>;

  abstract fetchProverFee(
    intent: Intent,
    messageData: Hex,
    chainId?: number | string,
    claimant?: Address,
  ): Promise<bigint>;
}
