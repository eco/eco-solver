@Injectable()
@Processor(QUEUES.ETH_SOCKET.queue)
export class EthWebsocketProcessor extends WorkerHost {
  private logger = new Logger(EthWebsocketProcessor.name)
  constructor(private readonly balanceService: BalanceService) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `EthWebsocketProcessor: process`,
      }),
    )

    switch (job.name) {
      case QUEUES.ETH_SOCKET.jobs.erc20_balance_socket:
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `EthWebsocketProcessor: ws event`,
            properties: {
              event: job.data,
            },
          }),
        )
        return this.balanceService.updateBalance(job.data as ViemEventLog)
      default:
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `EthWebsocketProcessor: Invalid job type ${job.name}`,
          }),
        )
        return Promise.reject('Invalid job type')
    }
  }
}
