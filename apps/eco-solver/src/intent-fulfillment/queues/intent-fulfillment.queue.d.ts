import { Queue } from 'bullmq';
import { Hex } from 'viem';
export declare enum IntentFulfillmentJobName {
    FULFILL_INTENT = "FULFILL_INTENT"
}
export type IntentFulfillmentQueueDataType = {
    intentHash: Hex;
    chainId: number;
};
export type IntentFulfillmentQueueType = Queue<IntentFulfillmentQueueDataType, unknown, IntentFulfillmentJobName>;
export declare class IntentFulfillmentQueue {
    private readonly queue;
    static readonly prefix = "{intent-fulfillment}";
    static readonly queueName = "IntentFulfillment";
    constructor(queue: IntentFulfillmentQueueType);
    get name(): string;
    static init(): import("@nestjs/common").DynamicModule;
    addFulfillIntentJob(jobData: any): Promise<import("bullmq").Job<IntentFulfillmentQueueDataType, unknown, IntentFulfillmentJobName>>;
}
