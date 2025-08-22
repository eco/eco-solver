import { Queue } from 'bullmq';
import { Hex } from 'viem';
import { LiquidityManagerJob, LiquidityManagerJobManager } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerJobName } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { LiquidityManagerProcessor } from '@eco-solver/liquidity-manager/processors/eco-protocol-intents.processor';
export interface CheckEverclearIntentJobData {
    txHash: Hex;
    id?: string;
    [key: string]: unknown;
}
export type CheckEverclearIntentJob = LiquidityManagerJob<LiquidityManagerJobName.CHECK_EVERCLEAR_INTENT, CheckEverclearIntentJobData, {
    status: 'pending' | 'complete' | 'failed';
    intentId?: string;
}>;
export declare class CheckEverclearIntentJobManager extends LiquidityManagerJobManager<CheckEverclearIntentJob> {
    static start(queue: Queue, data: CheckEverclearIntentJobData, delay?: number): Promise<void>;
    is(job: LiquidityManagerJob): job is CheckEverclearIntentJob;
    process(job: CheckEverclearIntentJob, processor: LiquidityManagerProcessor): Promise<CheckEverclearIntentJob['returnvalue']>;
    onComplete(job: CheckEverclearIntentJob, processor: LiquidityManagerProcessor): Promise<void>;
    onFailed(job: CheckEverclearIntentJob, processor: LiquidityManagerProcessor, error: unknown): void;
}
