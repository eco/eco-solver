import { ChainSyncService } from '@eco-solver/chain-monitor/chain-sync.service';
import { EcoConfigService } from '@libs/solver-config';
import { IntentFundedEventModel } from '@eco-solver/watch/intent/intent-funded-events/schemas/intent-funded-events.schema';
import { IntentFundedLog } from '@eco-solver/contracts';
import { IntentSource } from '@libs/solver-config';
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { Model } from 'mongoose';
import { ModuleRef } from '@nestjs/core';
import { WatchIntentFundedService } from '@eco-solver/watch/intent/intent-funded-events/services/watch-intent-funded.service';
/**
 * Service class for syncing any missing transactions for all the source intent contracts.
 * When the module starts up, it will check for any transactions that have occurred since the
 * last recorded transaction in the database and what is on chain. Intended to fill any
 * gap in transactions that may have been missed while the service was down.
 */
export declare class IntentFundedChainSyncService extends ChainSyncService {
    protected intentModel: Model<IntentSourceModel>;
    readonly kernelAccountClientService: KernelAccountClientService;
    readonly watchIntentService: WatchIntentFundedService;
    private readonly moduleRef;
    static MAX_BLOCK_RANGE: bigint;
    private createIntentService;
    constructor(intentModel: Model<IntentSourceModel>, kernelAccountClientService: KernelAccountClientService, watchIntentService: WatchIntentFundedService, ecoConfigService: EcoConfigService, moduleRef: ModuleRef);
    /**
     * Gets the missing transactions for a source intent contract by checking the last processed
     * event in the database and querying the chain for events from that block number.
     *
     * TODO: need to add pagination for large amounts of missing transactions with subgraphs at 10k events
     * @param source the source intent to get missing transactions for
     * @returns
     */
    getMissingTxs(source: IntentSource): Promise<IntentFundedLog[]>;
    /**
     * Returns the last recorded transaction for a source intent contract.
     *
     * @param source the source intent to get the last recorded transaction for
     * @returns
     */
    getLastRecordedTx(source: IntentSource): Promise<IntentFundedEventModel | undefined>;
}
