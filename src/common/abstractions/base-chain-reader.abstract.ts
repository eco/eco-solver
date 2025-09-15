import { Hex } from 'viem';

import { Call, Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { SystemLoggerService } from '@/modules/logging/logger.service';

export abstract class BaseChainReader {
  protected abstract readonly logger: SystemLoggerService;

  abstract getBalance(address: UniversalAddress, chainId?: number): Promise<bigint>;

  abstract getTokenBalance(
    tokenAddress: UniversalAddress,
    walletAddress: UniversalAddress,
    chainId: number,
  ): Promise<bigint>;

  abstract isIntentFunded(intent: Intent, chainId?: number): Promise<boolean>;

  abstract fetchProverFee(
    intent: Intent,
    prover: UniversalAddress,
    messageData: Hex,
    chainId: number,
    claimant: UniversalAddress,
  ): Promise<bigint>;

  /**
   * Validates if a call is a valid token transfer call for the specific blockchain
   * Also validates that the target is a supported token address on the given chain
   * @param call The route call to validate
   * @param chainId The chain ID to validate against
   * @returns Promise<boolean> true if the call is a valid token transfer to a supported token
   */
  abstract validateTokenTransferCall(
    call: Intent['route']['calls'][number],
    chainId: number,
  ): Promise<boolean>;

  /**
   * Builds a token transfer calldata for the specific blockchain
   * @param recipient The address of the recipient
   * @param token The address of the token contract
   * @param amount The amount of tokens to transfer
   * @returns Call object with encoded transfer data
   */
  abstract buildTokenTransferCalldata(
    recipient: UniversalAddress,
    token: UniversalAddress,
    amount: bigint,
  ): Call;
}
