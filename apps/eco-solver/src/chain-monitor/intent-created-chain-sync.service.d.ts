import { ChainSyncService } from '@eco-solver/chain-monitor/chain-sync.service';
import { EcoConfigService } from '@libs/solver-config';
import { IntentCreatedLog } from '../contracts';
import { IntentSource } from '@libs/solver-config';
import { IntentSourceModel } from '../intent/schemas/intent-source.schema';
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service';
import { Model } from 'mongoose';
import { WatchCreateIntentService } from '../watch/intent/watch-create-intent.service';
/**
 * Service class for syncing any missing transactions for all the source intent contracts.
 * When the module starts up, it will check for any transactions that have occurred since the
 * last recorded transaction in the database and what is on chain. Intended to fill any
 * gap in transactions that may have been missed while the service was down.
 */
export declare class IntentCreatedChainSyncService extends ChainSyncService {
    protected intentModel: Model<IntentSourceModel>;
    readonly kernelAccountClientService: KernelAccountClientService;
    readonly watchIntentService: WatchCreateIntentService;
    static MAX_BLOCK_RANGE: bigint;
    constructor(intentModel: Model<IntentSourceModel>, kernelAccountClientService: KernelAccountClientService, watchIntentService: WatchCreateIntentService, ecoConfigService: EcoConfigService);
    onApplicationBootstrap(): Promise<void>;
    /**
     * Gets the missing transactions for a source intent contract by checking the last processed
     * event in the database and querying the chain for events from that block number.
     *
     * TODO: need to add pagination for large amounts of missing transactions with subgraphs at 10k events
     * @param source the source intent to get missing transactions for
     * @returns
     */
    getMissingTxs(source: IntentSource): Promise<IntentCreatedLog[]>;
    /**
     * Returns the last recorded transaction for a source intent contract.
     *
     * @param source the source intent to get the last recorded transaction for
     * @returns
     */
    getLastRecordedTx(source: IntentSource): Promise<IntentSourceModel[]>;
}
