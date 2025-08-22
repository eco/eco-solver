import { Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { JobsOptions, Queue } from 'bullmq';
import { MultichainPublicClientService } from '../../transaction/multichain-public-client.service';
import { Log, PublicClient, WatchContractEventReturnType } from 'viem';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * This service subscribes has hooks for subscribing and unsubscribing to a contract event.
 */
export declare abstract class WatchEventService<T extends {
    chainID: number;
}> implements OnApplicationBootstrap, OnModuleDestroy {
    protected readonly queue: Queue;
    protected readonly publicClientService: MultichainPublicClientService;
    protected readonly ecoConfigService: EcoConfigService;
    protected readonly ecoAnalytics: EcoAnalyticsService;
    protected logger: Logger;
    protected unwatch: Record<string, WatchContractEventReturnType>;
    protected watchJobConfig: JobsOptions;
    constructor(queue: Queue, publicClientService: MultichainPublicClientService, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    onModuleInit(): Promise<void>;
    onApplicationBootstrap(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    /**
     * Subscribes to the events. It loads a mapping of the unsubscribe events to
     * call {@link onModuleDestroy} to close the clients.
     */
    abstract subscribe(): Promise<void>;
    /**
     * Subscribes to a contract on a specific chain
     * @param client the client to subscribe to
     * @param contract the contract to subscribe to
     */
    abstract subscribeTo(client: PublicClient, contract: T): Promise<void>;
    abstract addJob(source: T, opts?: {
        doValidation?: boolean;
    }): (logs: Log[]) => Promise<void>;
    /**
     * Unsubscribes from all events. It closes all clients in {@link onModuleDestroy}
     */
    unsubscribe(): Promise<void>;
    onError(error: any, client: PublicClient, contract: T): Promise<void>;
    /**
     * Unsubscribes from a specific chain
     * @param chainID the chain id to unsubscribe from
     */
    unsubscribeFrom(chainID: number): Promise<void>;
}
