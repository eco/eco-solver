import { EcoConfigService } from '@libs/solver-config';
import { IntentSource } from '@libs/solver-config';
import { IntentSourceModel } from '../intent/schemas/intent-source.schema';
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service';
import { Log } from 'viem';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Model } from 'mongoose';
import { WatchEventService } from '@eco-solver/watch/intent/watch-event.service';
/**
 * Service class for syncing any missing transactions for all the source intent contracts.
 * When the module starts up, it will check for any transactions that have occured since the
 * last recorded transaction in the database and what is on chain. Intended to fill any
 * gap in transactions that may have been missed while the serivce was down.
 */
export declare abstract class ChainSyncService implements OnApplicationBootstrap {
    protected intentModel: Model<IntentSourceModel>;
    protected kernelAccountClientService: KernelAccountClientService;
    protected watchIntentService: WatchEventService<IntentSource>;
    protected ecoConfigService: EcoConfigService;
    protected logger: Logger;
    constructor(intentModel: Model<IntentSourceModel>, kernelAccountClientService: KernelAccountClientService, watchIntentService: WatchEventService<IntentSource>, ecoConfigService: EcoConfigService, logger: Logger);
    onApplicationBootstrap(): Promise<void>;
    /**
     * Syncs all the missing transactions for all the source intent contracts.
     */
    syncTxs(): Promise<void>;
    /**
     * Returns the missing transactions for a source intent contract
     *
     * @param source the source intent to get the missing transactions for
     * @returns
     */
    syncTxsPerSource(source: IntentSource): Promise<void>;
    /**
     * Gets the missing transactions for a source intent contract by checking the last processed
     * event in the database and querying the chain for events from that block number.
     *
     * TODO: need to add pagination for large amounts of missing transactions with subgraphs at 10k events
     * @param source the source intent to get missing transactions for
     * @returns
     */
    abstract getMissingTxs(source: IntentSource): Promise<Log[]>;
}
