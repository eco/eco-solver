import { BaseProcessor } from '@/common/bullmq/base.processor'
import { CCTPLiFiDestinationSwapJobManager } from '@/liquidity-manager/jobs/cctp-lifi-destination-swap.job'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { CCTPV2ProviderService } from '../services/liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { CheckCCTPAttestationJobManager } from '@/liquidity-manager/jobs/check-cctp-attestation.job'
import { CheckCCTPV2AttestationJobManager } from '../jobs/check-cctpv2-attestation.job'
import { CheckEverclearIntentJobManager } from '@/liquidity-manager/jobs/check-everclear-intent.job'
import { EverclearProviderService } from '../services/liquidity-providers/Everclear/everclear-provider.service'
import { ExecuteCCTPMintJobManager } from '@/liquidity-manager/jobs/execute-cctp-mint.job'
import { ExecuteCCTPV2MintJobManager } from '../jobs/execute-cctpv2-mint.job'
import { GatewayTopUpJobManager } from '../jobs/gateway-topup.job'
import { CheckOFTDeliveryJobManager } from '../jobs/check-oft-delivery.job'
import { Injectable } from '@nestjs/common'
import { InjectQueue, Processor } from '@nestjs/bullmq'
import { LiquidityManagerJob } from '@/liquidity-manager/jobs/liquidity-manager.job'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { RebalanceJobManager } from '@/liquidity-manager/jobs/rebalance.job'
import { USDT0LiFiDestinationSwapJobManager } from '../jobs/usdt0-lifi-destination-swap.job'
import { CheckCCIPDeliveryJobManager } from '../jobs/check-ccip-delivery.job'

/**
 * Processor for handling liquidity manager jobs.
 */
@Injectable()
@Processor(LiquidityManagerQueue.queueName, { concurrency: 10 })
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
      new RebalanceJobManager(),
      new ExecuteCCTPMintJobManager(),
      new CheckCCTPAttestationJobManager(),
      new CCTPLiFiDestinationSwapJobManager(),
      new CheckCCTPV2AttestationJobManager(),
      new ExecuteCCTPV2MintJobManager(),
      new CheckEverclearIntentJobManager(),
      new GatewayTopUpJobManager(),
      new CheckOFTDeliveryJobManager(),
      new USDT0LiFiDestinationSwapJobManager(),
      new CheckCCIPDeliveryJobManager(),
    ])
  }
}
