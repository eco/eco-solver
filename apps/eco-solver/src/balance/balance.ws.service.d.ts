import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { Network } from '@eco-solver/common/alchemy/network';
import { Queue } from 'bullmq';
import { ViemEventLog } from '../common/events/viem';
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service';
export declare class BalanceWebsocketService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly ethQueue;
    private readonly kernelAccountClientService;
    private readonly ecoConfigService;
    private logger;
    private intentJobConfig;
    private unwatch;
    constructor(ethQueue: Queue, kernelAccountClientService: KernelAccountClientService, ecoConfigService: EcoConfigService);
    onApplicationBootstrap(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    subscribeWS(): Promise<void>;
    addJob(network: Network, chainID: number): (logs: ViemEventLog[]) => Promise<void>;
}
