import { DecodeEventLogReturnType, Log, Prettify } from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { IProverAbi } from '@eco-foundation/routes-ts'
import { Network } from '@/common/alchemy/network'

/**
 * Define the type for the IntentProvenEvent log
 */
export type IntentProvenEventLog = DecodeEventLogReturnType<typeof IProverAbi, 'IntentProven'>

/**
 * Define the type for the IntentProven log
 */
export type IntentProvenLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof IProverAbi, 'IntentProven'>, true> & {
    sourceNetwork: Network
    sourceChainID: bigint
  }
>
