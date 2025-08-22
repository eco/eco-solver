import { Queue } from 'bullmq';
import { Hex } from 'viem';
import { LiquidityManagerJob, LiquidityManagerJobManager } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerJobName } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { CCTPV2StrategyContext } from '../types/types';
import { LiquidityManagerProcessor } from '../processors/eco-protocol-intents.processor';
import { Serialize } from '@eco-solver/common/utils/serialize';
export interface ExecuteCCTPV2MintJobData {
    destinationChainId: number;
    messageHash: Hex;
    messageBody: Hex;
    attestation: Hex;
    context: Serialize<CCTPV2StrategyContext>;
    id?: string;
    [key: string]: unknown;
}
export type ExecuteCCTPV2MintJob = LiquidityManagerJob<LiquidityManagerJobName.EXECUTE_CCTPV2_MINT, ExecuteCCTPV2MintJobData, Hex>;
export declare class ExecuteCCTPV2MintJobManager extends LiquidityManagerJobManager<ExecuteCCTPV2MintJob> {
    static start(queue: Queue, data: ExecuteCCTPV2MintJob['data']): Promise<void>;
    is(job: LiquidityManagerJob): job is ExecuteCCTPV2MintJob;
    process(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor): Promise<Hex>;
    onComplete(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor): Promise<void>;
    onFailed(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor, error: unknown): void;
}
