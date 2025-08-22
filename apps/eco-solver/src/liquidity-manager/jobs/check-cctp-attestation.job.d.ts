import { Queue } from 'bullmq';
import { Hex } from 'viem';
import { LiquidityManagerJob, LiquidityManagerJobManager } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerJobName } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { LiquidityManagerProcessor } from '@eco-solver/liquidity-manager/processors/eco-protocol-intents.processor';
import { LiFiStrategyContext } from '@eco-solver/liquidity-manager/types/types';
export interface CheckCCTPAttestationJobData {
    destinationChainId: number;
    messageHash: Hex;
    messageBody: Hex;
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
    [key: string]: unknown;
}
export type CheckCCTPAttestationJob = LiquidityManagerJob<LiquidityManagerJobName.CHECK_CCTP_ATTESTATION, CheckCCTPAttestationJobData, {
    status: 'pending';
} | {
    status: 'complete';
    attestation: Hex;
}>;
export declare class CheckCCTPAttestationJobManager extends LiquidityManagerJobManager<CheckCCTPAttestationJob> {
    /**
     * Starts a job scheduler for checking CCTP attestation.
     *
     * @param {Queue} queue - The queue instance where the job will be added.
     * @param {CheckCCTPAttestationJobData} data - The data payload for the CheckCCTPAttestationJob.
     * @param {number} delay - Delay processing
     * @return {Promise<void>} A promise that resolves when the job scheduler is successfully added.
     */
    static start(queue: Queue, data: CheckCCTPAttestationJobData, delay?: number): Promise<void>;
    /**
     * Type guard to check if the given job is an instance of CheckCCTPAttestationJob.
     * @param job - The job to check.
     * @returns True if the job is a CheckCCTPAttestationJob.
     */
    is(job: LiquidityManagerJob): job is CheckCCTPAttestationJob;
    /**
     * Processes the given job by fetching the attestation using the provided processor.
     *
     * @param {CheckCCTPAttestationJob} job - The job containing data required for fetching the attestation.
     * @param {LiquidityManagerProcessor} processor - The processor used to handle the business logic and fetch the attestation.
     * @return {Promise<CheckCCTPAttestationJob['returnvalue']>} A promise that resolves with the result of the fetched attestation.
     */
    process(job: CheckCCTPAttestationJob, processor: LiquidityManagerProcessor): Promise<CheckCCTPAttestationJob['returnvalue']>;
    onComplete(job: CheckCCTPAttestationJob, processor: LiquidityManagerProcessor): Promise<void>;
    /**
     * Handles job failures by logging the error.
     * @param job - The job that failed.
     * @param processor - The processor handling the job.
     * @param error - The error that occurred.
     */
    onFailed(job: CheckCCTPAttestationJob, processor: LiquidityManagerProcessor, error: unknown): void;
}
