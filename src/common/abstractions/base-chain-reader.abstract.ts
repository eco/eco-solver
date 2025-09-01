import { Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { SystemLoggerService } from '@/modules/logging/logger.service';

export abstract class BaseChainReader {
  protected abstract readonly logger: SystemLoggerService;

  abstract getBalance(address: UniversalAddress, chainId?: number | string): Promise<bigint>;

  abstract getTokenBalance(
    tokenAddress: UniversalAddress,
    walletAddress: UniversalAddress,
    chainId: number | string,
  ): Promise<bigint>;

  abstract isIntentFunded(intent: Intent, chainId?: number | string): Promise<boolean>;

  abstract fetchProverFee(
    intent: Intent,
    prover: UniversalAddress,
    messageData: Hex,
    chainId: number | string,
    claimant: UniversalAddress,
  ): Promise<bigint>;
}
