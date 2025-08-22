import { InboxAbi } from '@eco-foundation/routes-ts';
import { ExtractAbiEvent } from 'abitype';
import { Prettify, Log } from 'viem';
export type FulfillmentLog = Prettify<Log<bigint, number, false, ExtractAbiEvent<typeof InboxAbi, 'Fulfillment'>, true>>;
