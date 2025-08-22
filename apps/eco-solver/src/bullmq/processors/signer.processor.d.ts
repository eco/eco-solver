import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NonceService } from '../../sign/nonce.service';
export declare class SignerProcessor extends WorkerHost {
    private readonly nonceService;
    private logger;
    constructor(nonceService: NonceService);
    process(job: Job<any, any, string>, processToken?: string | undefined): Promise<any>;
}
