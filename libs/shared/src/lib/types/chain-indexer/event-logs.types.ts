import { Log } from 'viem'

export interface IntentCreatedLog extends Log {
  sourceChainID: bigint
  sourceNetwork: string
  args: {
    hash: string
    prover: string
    destination: bigint
  }
}

export interface IntentFundedLog extends Log {
  sourceChainID: bigint
  sourceNetwork: string  
  args: {
    intentHash: string
  }
}

export interface FulfillmentLog extends Log {
  args: {
    _hash: string
    _sourceChainID: bigint
  }
}