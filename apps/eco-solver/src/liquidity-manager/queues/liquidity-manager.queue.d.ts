import { Queue } from 'bullmq';
import { CheckCCTPAttestationJob } from '@eco-solver/liquidity-manager/jobs/check-cctp-attestation.job';
import { CCTPLiFiDestinationSwapJobData } from '@eco-solver/liquidity-manager/jobs/cctp-lifi-destination-swap.job';
import { ExecuteCCTPMintJob } from '../jobs/execute-cctp-mint.job';
import { CheckCCTPV2AttestationJobData } from '../jobs/check-cctpv2-attestation.job';
import { ExecuteCCTPV2MintJob } from '../jobs/execute-cctpv2-mint.job';
import { CheckEverclearIntentJobData } from '../jobs/check-everclear-intent.job';
export declare enum LiquidityManagerJobName {
    REBALANCE = "REBALANCE",
    CHECK_BALANCES = "CHECK_BALANCES",
    CHECK_CCTP_ATTESTATION = "CHECK_CCTP_ATTESTATION",
    EXECUTE_CCTP_MINT = "EXECUTE_CCTP_MINT",
    CCTP_LIFI_DESTINATION_SWAP = "CCTP_LIFI_DESTINATION_SWAP",
    CHECK_CCTPV2_ATTESTATION = "CHECK_CCTPV2_ATTESTATION",
    EXECUTE_CCTPV2_MINT = "EXECUTE_CCTPV2_MINT",
    CHECK_EVERCLEAR_INTENT = "CHECK_EVERCLEAR_INTENT"
}
export type LiquidityManagerQueueDataType = {
    /**
     * Correlation / tracking identifier that will propagate through every job handled by the
     * Liquidity Manager queue. Having this always present allows us to group logs that belong
     * to the same high-level operation or request.
     */
    id?: string;
    [k: string]: unknown;
};
export type LiquidityManagerQueueType = Queue<LiquidityManagerQueueDataType, unknown, LiquidityManagerJobName>;
export declare class LiquidityManagerQueue {
    private readonly queue;
    static readonly prefix = "{liquidity-manager}";
    static readonly queueName: string;
    static readonly flowName = "flow-liquidity-manager";
    constructor(queue: LiquidityManagerQueueType);
    get name(): string;
    static init(): import("@nestjs/common").DynamicModule;
    static initFlow(): import("@nestjs/common").DynamicModule;
    startCronJobs(interval: number, walletAddress: string): Promise<void>;
    startCCTPAttestationCheck(data: CheckCCTPAttestationJob['data']): Promise<void>;
    startCCTPLiFiDestinationSwap(data: CCTPLiFiDestinationSwapJobData): Promise<void>;
    startExecuteCCTPMint(data: ExecuteCCTPMintJob['data']): Promise<void>;
    startCCTPV2AttestationCheck(data: CheckCCTPV2AttestationJobData): Promise<void>;
    startExecuteCCTPV2Mint(data: ExecuteCCTPV2MintJob['data']): Promise<void>;
    startCheckEverclearIntent(data: CheckEverclearIntentJobData): Promise<void>;
}
