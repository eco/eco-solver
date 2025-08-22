import { Queue } from 'bullmq';
import { Hex } from 'viem';
import { LiquidityManagerJob, LiquidityManagerJobManager } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerJobName } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { LiquidityManagerProcessor } from '@eco-solver/liquidity-manager/processors/eco-protocol-intents.processor';
import { LiFiStrategyContext } from '@eco-solver/liquidity-manager/types/types';
export interface CCTPLiFiDestinationSwapJobData {
    messageHash: Hex;
    messageBody: Hex;
    attestation: Hex;
    destinationChainId: number;
    destinationSwapQuote: LiFiStrategyContext;
    walletAddress: string;
    originalTokenOut: {
        address: Hex;
        chainId: number;
        decimals: number;
    };
    cctpTransactionHash?: Hex;
    retryCount?: number;
    id?: string;
    [key: string]: unknown;
}
export type CCTPLiFiDestinationSwapJob = LiquidityManagerJob<LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP, CCTPLiFiDestinationSwapJobData, {
    txHash: Hex;
    finalAmount: string;
}>;
export declare class CCTPLiFiDestinationSwapJobManager extends LiquidityManagerJobManager<CCTPLiFiDestinationSwapJob> {
    /**
     * Starts a job for executing the destination swap after CCTP attestation
     */
    static start(queue: Queue, data: CCTPLiFiDestinationSwapJobData, delay?: number): Promise<void>;
    /**
     * Type guard to check if the given job is a CCTPLiFiDestinationSwapJob
     */
    is(job: CCTPLiFiDestinationSwapJob): boolean;
    /**
     * Processes the destination swap job with enhanced error logging for recovery
     */
    process(job: CCTPLiFiDestinationSwapJob, processor: LiquidityManagerProcessor): Promise<CCTPLiFiDestinationSwapJob['returnvalue']>;
    /**
     * Executes the LiFi swap on the destination chain
     */
    private executeDestinationSwap;
    /**
     * Handles successful job completion with enhanced logging
     */
    onComplete(job: CCTPLiFiDestinationSwapJob, processor: LiquidityManagerProcessor): Promise<void>;
    /**
     * Handles job failures with detailed error logging for recovery purposes
     */
    onFailed(job: CCTPLiFiDestinationSwapJob, processor: LiquidityManagerProcessor, error: unknown): void;
}
