  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@app/liquidity-manager/queues/liquidity-manager.queue'

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
