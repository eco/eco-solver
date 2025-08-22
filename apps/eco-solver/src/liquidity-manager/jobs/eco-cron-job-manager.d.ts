import { Queue } from 'bullmq';
export declare class EcoCronJobManager {
    private readonly jobName;
    private readonly jobIDPrefix;
    private logger;
    private started;
    private stopRequested;
    constructor(jobName: string, jobIDPrefix: string);
    /**
     * Starts the cron job.
     * @param queue - The job queue to add the job to.
     * @param interval - Interval duration in which the job is repeated
     * @param walletAddress - Wallet address
     */
    start(queue: Queue, interval: number, walletAddress: string): Promise<void>;
    stop(): void;
    private delay;
    private createJobTemplate;
    private checkAndEmitDeduped;
}
