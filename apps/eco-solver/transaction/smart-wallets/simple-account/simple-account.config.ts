import type { Hex, WalletClientConfig } from 'viem'

export interface SimpleAccountClientConfig extends WalletClientConfig {
  simpleAccountAddress: Hex
}
