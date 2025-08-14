import { Hex } from 'viem'

export type DeployFactoryArgs = {
  factory?: Hex | undefined
  factoryData?: Hex | undefined
  deployReceipt?: Hex | undefined
  chainID?: number
}