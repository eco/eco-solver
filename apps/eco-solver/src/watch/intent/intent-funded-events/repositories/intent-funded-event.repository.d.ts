import { EcoResponse } from '@eco-solver/common/eco-response';
import { IntentFundedEventModel } from '@eco-solver/watch/intent/intent-funded-events/schemas/intent-funded-events.schema';
import { IntentFundedLog } from '@eco-solver/contracts';
import { Model } from 'mongoose';
/**
 * IntentFundedEventRepository is responsible for interacting with the database to store and fetch
 * intent funded event data.
 */
export declare class IntentFundedEventRepository {
    private model;
    private logger;
    constructor(model: Model<IntentFundedEventModel>);
    addEvent(addIntentFundedEvent: IntentFundedLog): Promise<EcoResponse<IntentFundedEventModel>>;
    /**
     * Returns the last recorded transaction for a source intent contract.
     *
     * @param sourceChainID the sourceChainID to get the last recorded transaction for
     * @returns
     */
    getLastRecordedTx(sourceChainID: bigint): Promise<IntentFundedEventModel | undefined>;
}
