import { Log } from 'viem'

export type ViemEventLog = Log & { 
  sourceNetwork: string
  sourceChainID: bigint 
}