import { BaseProcessor } from '@eco-solver/common/bullmq/base.processor';
import { LiquidityManagerService } from '@eco-solver/liquidity-manager/services/liquidity-manager.service';
import { LiquidityManagerJob } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerQueueType } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { CCTPProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service';
import { CCTPV2ProviderService } from '../services/liquidity-providers/CCTP-V2/cctpv2-provider.service';
import { EverclearProviderService } from '../services/liquidity-providers/Everclear/everclear-provider.service';
/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
export declare class LiquidityManagerProcessor extends BaseProcessor<LiquidityManagerJob> {
    readonly queue: LiquidityManagerQueueType;
    readonly liquidityManagerService: LiquidityManagerService;
    readonly cctpProviderService: CCTPProviderService;
    readonly cctpv2ProviderService: CCTPV2ProviderService;
    readonly everclearProviderService: EverclearProviderService;
    /**
     * Constructs a new LiquidityManagerProcessor.
     * @param queue - The queue to process jobs from.
     * @param liquidityManagerService - The service for managing liquidity.
     * @param cctpProviderService - The service for CCTP.
     */
    constructor(queue: LiquidityManagerQueueType, liquidityManagerService: LiquidityManagerService, cctpProviderService: CCTPProviderService, cctpv2ProviderService: CCTPV2ProviderService, everclearProviderService: EverclearProviderService);
}
