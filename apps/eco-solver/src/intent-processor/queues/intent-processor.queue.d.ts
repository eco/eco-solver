import { Queue } from 'bullmq';
import { ExecuteWithdrawsJobData } from '@eco-solver/intent-processor/jobs/execute-withdraws.job';
import { ExecuteSendBatchJobData } from '@eco-solver/intent-processor/jobs/execute-send-batch.job';
export declare enum IntentProcessorJobName {
    CHECK_WITHDRAWS = "CHECK_WITHDRAWS",
    CHECK_SEND_BATCH = "CHECK_SEND_BATCH",
    EXECUTE_WITHDRAWS = "EXECUTE_WITHDRAWS",
    EXECUTE_SEND_BATCH = "EXECUTE_SEND_BATCH"
}
export type IntentProcessorQueueDataType = any;
export type IntentProcessorQueueType = Queue<IntentProcessorQueueDataType, unknown, IntentProcessorJobName>;
export declare class IntentProcessorQueue {
    private readonly queue;
    static readonly prefix = "{intent-processor}";
    static readonly queueName: string;
    constructor(queue: IntentProcessorQueueType);
    get name(): string;
    static init(): import("@nestjs/common").DynamicModule;
    startWithdrawalsCronJobs(interval: number): Promise<void>;
    startSendBatchCronJobs(interval: number): Promise<void>;
    addExecuteWithdrawalsJobs(jobsData: ExecuteWithdrawsJobData[]): Promise<import("bullmq").Job<any, unknown, string>[]>;
    addExecuteSendBatchJobs(jobsData: ExecuteSendBatchJobData[]): Promise<import("bullmq").Job<any, unknown, string>[]>;
}
