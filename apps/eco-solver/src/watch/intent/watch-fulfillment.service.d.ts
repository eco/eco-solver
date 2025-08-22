import { Logger } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { Solver } from '@libs/solver-config';
import { Queue } from 'bullmq';
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service';
import { PublicClient } from 'viem';
import { WatchEventService } from '@eco-solver/watch/intent/watch-event.service';
import { FulfillmentLog } from '@eco-solver/contracts/inbox';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * This service subscribes to Inbox contracts for Fulfillment events. It subscribes on all
 * supported chains and prover addresses. When an event is emitted, adds the event
 * to the queue to update the intent in the database.
 */
export declare class WatchFulfillmentService extends WatchEventService<Solver> {
    protected readonly inboxQueue: Queue;
    protected readonly publicClientService: MultichainPublicClientService;
    protected readonly ecoConfigService: EcoConfigService;
    protected readonly ecoAnalytics: EcoAnalyticsService;
    protected logger: Logger;
    constructor(inboxQueue: Queue, publicClientService: MultichainPublicClientService, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    /**
     * Subscribes to all Inbox constacts for Fulfillment events. It loads a mapping of the unsubscribe events to
     * call {@link onModuleDestroy} to close the clients.
     */
    subscribe(): Promise<void>;
    unsubscribe(): Promise<void>;
    /**
     * Checks to see what networks we have intent sources for
     * @returns the supported chains for the event
     */
    getSupportedChains(): bigint[];
    subscribeTo(client: PublicClient, solver: Solver): Promise<void>;
    addJob(solver?: Solver): (logs: FulfillmentLog[]) => Promise<void>;
}
