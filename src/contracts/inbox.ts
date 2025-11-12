import { ExtractAbiEvent } from 'abitype'
import { Log, Prettify } from 'viem'
import { portalAbi } from '@/contracts/v2-abi/Portal'

// Define the type for the Fulfillment event log
export type FulfillmentLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof portalAbi, 'IntentFulfilled'>, true>
>
