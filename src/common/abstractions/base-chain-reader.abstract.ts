import { Logger } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';

export abstract class BaseChainReader {
  protected abstract readonly logger: Logger;

  abstract getBalance(address: string): Promise<bigint>;

  abstract getTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint>;

  abstract isAddressValid(address: string): boolean;

  abstract isIntentFunded(intent: Intent): Promise<boolean>;
}
