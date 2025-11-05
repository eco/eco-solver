import { Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';

/**
 * Parameters for permit3 transaction execution
 */
export interface Permit3Params {
  chainId: number;
  permitContract: UniversalAddress;
  owner: UniversalAddress;
  salt: Hex;
  deadline: number;
  timestamp: number;
  permits: Array<{
    modeOrExpiration: number;
    tokenKey: Hex;
    account: UniversalAddress;
    amountDelta: bigint;
  }>;
  merkleProof: Hex[];
  signature: Hex;
  walletType?: WalletType;
}

/**
 * Parameters for fundFor transaction execution
 */
export interface FundForParams {
  chainId: number;
  destination: bigint;
  routeHash: Hex;
  reward: Intent['reward'];
  allowPartial: boolean;
  funder: UniversalAddress;
  permitContract: UniversalAddress;
  walletType?: WalletType;
}
