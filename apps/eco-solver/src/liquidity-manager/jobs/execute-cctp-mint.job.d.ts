import { Queue } from 'bullmq';
import { Hex } from 'viem';
import { LiquidityManagerJob, LiquidityManagerJobManager } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerJobName } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { LiquidityManagerProcessor } from '@eco-solver/liquidity-manager/processors/eco-protocol-intents.processor';
import { LiFiStrategyContext } from '../types/types';
export type ExecuteCCTPMintJob = LiquidityManagerJob<LiquidityManagerJobName.EXECUTE_CCTP_MINT, {
    destinationChainId: number;
    messageHash: Hex;
    messageBody: Hex;
    attestation: Hex;
    cctpLiFiContext?: {
        destinationSwapQuote: LiFiStrategyContext;
        walletAddress: string;
        originalTokenOut: {
            address: Hex;
            chainId: number;
            decimals: number;
        };
    };
    id?: string;
}, Hex>;
export declare class ExecuteCCTPMintJobManager extends LiquidityManagerJobManager<ExecuteCCTPMintJob> {
    static start(queue: Queue, data: ExecuteCCTPMintJob['data']): Promise<void>;
    /**
     * Type guard to check if the given job is an instance of ExecuteCCTPMintJob.
     * @param job - The job to check.
     * @returns True if the job is a ExecuteCCTPMintJob.
     */
    is(job: LiquidityManagerJob): job is ExecuteCCTPMintJob;
    process(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessor): Promise<Hex>;
    onComplete(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessor): Promise<void>;
    /**
     * Handles job failures by logging the error.
     * @param job - The job that failed.
     * @param processor - The processor handling the job.
     * @param error - The error that occurred.
     */
    onFailed(job: ExecuteCCTPMintJob, processor: LiquidityManagerProcessor, error: unknown): void;
}
