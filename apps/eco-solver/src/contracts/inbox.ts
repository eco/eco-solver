import { InboxAbi } from '@eco-foundation/routes-ts'
import { ExtractAbiEvent } from 'abitype'
import { Prettify, Log } from 'viem'

// Define the type for the Fulfillment event log
export type FulfillmentLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof InboxAbi, 'Fulfillment'>, true>
>
