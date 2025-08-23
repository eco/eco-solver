import { Injectable } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'
import { BaseProcessor } from '../../common/bullmq/base.processor'
import { LiquidityManagerService } from '../services/liquidity-manager.service'
import { RebalanceJobManager } from '../jobs/rebalance.job'
import { LiquidityManagerJob } from '../jobs/liquidity-manager.job'
import { CheckBalancesCronJobManager } from '../jobs/check-balances-cron.job'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '../queues/liquidity-manager.queue'
import { CCTPProviderService } from '../services/liquidity-providers/CCTP/cctp-provider.service'
import { CheckCCTPAttestationJobManager } from '../jobs/check-cctp-attestation.job'
import { ExecuteCCTPMintJobManager } from '../jobs/execute-cctp-mint.job'
import { CCTPLiFiDestinationSwapJobManager } from '../jobs/cctp-lifi-destination-swap.job'
import { CCTPV2ProviderService } from '../services/liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { CheckCCTPV2AttestationJobManager } from '../jobs/check-cctpv2-attestation.job'
import { ExecuteCCTPV2MintJobManager } from '../jobs/execute-cctpv2-mint.job'
import { CheckEverclearIntentJobManager } from '../jobs/check-everclear-intent.job'
import { EverclearProviderService } from '../services/liquidity-providers/Everclear/everclear-provider.service'

/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
@Injectable()
@Processor(LiquidityManagerQueue.queueName)
export class LiquidityManagerProcessor extends BaseProcessor<LiquidityManagerJob> {
  /**
   * Constructs a new LiquidityManagerProcessor.
   * @param queue - The queue to process jobs from.
   * @param liquidityManagerService - The service for managing liquidity.
   * @param cctpProviderService - The service for CCTP.
   */
  constructor(
    @InjectQueue(LiquidityManagerQueue.queueName)
    public readonly queue: LiquidityManagerQueueType,
    public readonly liquidityManagerService: LiquidityManagerService,
    public readonly cctpProviderService: CCTPProviderService,
    public readonly cctpv2ProviderService: CCTPV2ProviderService,
    public readonly everclearProviderService: EverclearProviderService,
  ) {
    super(LiquidityManagerProcessor.name, [
      new CheckBalancesCronJobManager(),
      new RebalanceJobManager(),
      new ExecuteCCTPMintJobManager(),
      new CheckCCTPAttestationJobManager(),
      new CCTPLiFiDestinationSwapJobManager(),
      new CheckCCTPV2AttestationJobManager(),
      new ExecuteCCTPV2MintJobManager(),
      new CheckEverclearIntentJobManager(),
    ])
  }
}
