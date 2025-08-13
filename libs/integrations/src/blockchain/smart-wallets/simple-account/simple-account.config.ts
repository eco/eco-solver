import { Hex } from 'viem'
import { WalletClientConfig } from 'viem'

export interface SimpleAccountClientConfig extends WalletClientConfig {
  simpleAccountAddress: Hex
}
