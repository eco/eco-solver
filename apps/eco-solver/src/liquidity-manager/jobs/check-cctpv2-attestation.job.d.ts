import { Queue } from 'bullmq';
import { Hex } from 'viem';
import { LiquidityManagerJob, LiquidityManagerJobManager } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerJobName } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { CCTPV2StrategyContext } from '../types/types';
import { LiquidityManagerProcessor } from '../processors/eco-protocol-intents.processor';
import { Serialize } from '@eco-solver/common/utils/serialize';
export interface CheckCCTPV2AttestationJobData {
    sourceDomain: number;
    destinationChainId: number;
    transactionHash: Hex;
    context: Serialize<CCTPV2StrategyContext>;
    id?: string;
    [key: string]: unknown;
}
export type CheckCCTPV2AttestationJob = LiquidityManagerJob<LiquidityManagerJobName.CHECK_CCTPV2_ATTESTATION, CheckCCTPV2AttestationJobData, {
    status: 'pending';
} | {
    status: 'complete';
    messageBody: Hex;
    attestation: Hex;
}>;
export declare class CheckCCTPV2AttestationJobManager extends LiquidityManagerJobManager<CheckCCTPV2AttestationJob> {
    static start(queue: Queue, data: CheckCCTPV2AttestationJobData, delay?: number): Promise<void>;
    is(job: LiquidityManagerJob): job is CheckCCTPV2AttestationJob;
    process(job: CheckCCTPV2AttestationJob, processor: LiquidityManagerProcessor): Promise<CheckCCTPV2AttestationJob['returnvalue']>;
    onComplete(job: CheckCCTPV2AttestationJob, processor: LiquidityManagerProcessor): Promise<void>;
    onFailed(job: CheckCCTPV2AttestationJob, processor: LiquidityManagerProcessor, error: unknown): void;
}
