import { TronWeb } from 'tronweb';

/** TVM Event Response type helper */
export type TvmEventResponse = Awaited<ReturnType<TronWeb['event']['getEventsByContractAddress']>>;
// TvmEvent types are now exported from RawEventLogs namespace
export type TvmEvent = Extract<TvmEventResponse['data'], unknown[]>[number];
