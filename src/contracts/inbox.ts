import { IInboxAbi } from 'v2-abi/IInbox'
import { ExtractAbiEvent } from 'abitype'
import { Prettify, Log } from 'viem'

// Define the type for the Fulfillment event log
export type FulfillmentLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof IInboxAbi, 'IntentFulfilled'>, true>
>
