import { Log, Prettify } from 'viem'
import { InboxAbi } from '@eco-foundation/routes-ts'

// Define the type for the Fulfillment event log - simplified without ExtractAbiEvent
export type FulfillmentLog = Log & {
  args: any // TODO: Type this properly when ExtractAbiEvent equivalent is available
}
