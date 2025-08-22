import type { WalletClientConfig } from 'viem';
import type { Hex } from 'viem/_types/types/misc';
export interface SimpleAccountClientConfig extends WalletClientConfig {
    simpleAccountAddress: Hex;
}
