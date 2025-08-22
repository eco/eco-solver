import { Logger } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { Queue } from 'bullmq';
import { IntentSource } from '@libs/solver-config';
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service';
import { Log, PublicClient } from 'viem';
import { WatchEventService } from '@eco-solver/watch/intent/watch-event.service';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * This service subscribes to IntentSource contracts for IntentCreated events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, it mutates the event log, and then
 * adds it intent queue for processing.
 */
export declare class WatchCreateIntentService extends WatchEventService<IntentSource> {
    protected readonly intentQueue: Queue;
    protected readonly publicClientService: MultichainPublicClientService;
    protected readonly ecoConfigService: EcoConfigService;
    protected readonly ecoAnalytics: EcoAnalyticsService;
    protected logger: Logger;
    constructor(intentQueue: Queue, publicClientService: MultichainPublicClientService, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    /**
     * Subscribes to all IntentSource contracts for IntentCreated events. It subscribes on all supported chains
     * filtering on the prover addresses and destination chain ids. It loads a mapping of the unsubscribe events to
     * call {@link onModuleDestroy} to close the clients.
     */
    subscribe(): Promise<void>;
    /**
     * Unsubscribes from all IntentSource contracts. It closes all clients in {@link onModuleDestroy}
     */
    unsubscribe(): Promise<void>;
    subscribeTo(client: PublicClient, source: IntentSource): Promise<void>;
    addJob(source: IntentSource): (logs: Log[]) => Promise<void>;
}
