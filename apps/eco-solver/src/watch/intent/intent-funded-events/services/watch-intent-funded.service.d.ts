import { CreateIntentService } from '@eco-solver/intent/create-intent.service';
import { EcoConfigService } from '@libs/solver-config';
import { Logger } from '@nestjs/common';
import { IntentFundedEventModel } from '@eco-solver/watch/intent/intent-funded-events/schemas/intent-funded-events.schema';
import { IntentFundedEventRepository } from '@eco-solver/watch/intent/intent-funded-events/repositories/intent-funded-event.repository';
import { IntentFundedLog } from '@eco-solver/contracts';
import { IntentSource } from '@libs/solver-config';
import { Log, PublicClient } from 'viem';
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service';
import { Queue } from 'bullmq';
import { WatchEventService } from '@eco-solver/watch/intent/watch-event.service';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * This service subscribes to IntentSource contracts for IntentFunded events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, it mutates the event log, and then
 * adds it intent queue for processing.
 */
export declare class WatchIntentFundedService extends WatchEventService<IntentSource> {
    protected readonly intentQueue: Queue;
    private readonly intentFundedEventRepository;
    protected readonly publicClientService: MultichainPublicClientService;
    private createIntentService;
    protected readonly ecoConfigService: EcoConfigService;
    protected readonly ecoAnalytics: EcoAnalyticsService;
    protected logger: Logger;
    constructor(intentQueue: Queue, intentFundedEventRepository: IntentFundedEventRepository, publicClientService: MultichainPublicClientService, createIntentService: CreateIntentService, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    /**
     * Subscribes to all IntentSource contracts for IntentFunded events. It subscribes on all supported chains
     * filtering on the prover addresses and destination chain ids. It loads a mapping of the unsubscribe events to
     * call {@link onModuleDestroy} to close the clients.
     */
    subscribe(): Promise<void>;
    /**
     * Unsubscribes from all IntentSource contracts. It closes all clients in {@link onModuleDestroy}
     */
    unsubscribe(): Promise<void>;
    subscribeTo(client: PublicClient, source: IntentSource): Promise<void>;
    private isOurIntent;
    addJob(source: IntentSource, opts?: {
        doValidation?: boolean;
    }): (logs: Log[]) => Promise<void>;
    addIntentFundedEvent(addIntentFundedEvent: IntentFundedLog): Promise<void>;
    /**
     * Returns the last recorded transaction for a source intent contract.
     *
     * @param sourceChainID the sourceChainID to get the last recorded transaction for
     * @returns
     */
    getLastRecordedTx(sourceChainID: bigint): Promise<IntentFundedEventModel | undefined>;
}
