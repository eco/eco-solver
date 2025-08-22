import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BalanceService } from '../../balance/balance.service';
export declare class EthWebsocketProcessor extends WorkerHost {
    private readonly balanceService;
    private logger;
    constructor(balanceService: BalanceService);
    process(job: Job<any, any, string>, processToken?: string | undefined): Promise<any>;
}
