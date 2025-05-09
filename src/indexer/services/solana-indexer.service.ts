import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { Connection, PublicKey } from '@solana/web3.js'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { decodeIntentAccount } from './solana-intent-decoder'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { InjectQueue } from '@nestjs/bullmq'

@Injectable()
export class SolanaIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SolanaIndexerService.name)
  private connection!: Connection
  private subId?: number

  constructor(
    private readonly ecoConfig: EcoConfigService,
    private readonly intentUtils: UtilsIntentService,
    @InjectQueue(QUEUES.SOLANA_INTENT.queue)
    private readonly svmQueue: Queue,
  ) {}

  async onModuleInit() {
    const solConfig = this.ecoConfig.getSolanaConfig()
    this.connection = new Connection(solConfig.rpc_url, {
      commitment: 'confirmed',
      wsEndpoint: solConfig.rpc_ws_url,
    })

    this.subId = this.connection.onProgramAccountChange(
      new PublicKey(solConfig.router_program_id),
      async ({ accountId, accountInfo }) => {
        try {
          const intent = decodeIntentAccount(accountId, accountInfo.data)

          await this.intentUtils.updateIntentModel({
            event: {} as any,
            intent: intent as any,
            receipt: undefined,
            status: 'PENDING',
            chain: 'SVM',
          } as any)

          await this.svmQueue.add(QUEUES.SOLANA_INTENT.jobs.feasable_intent, intent.hash, {
            jobId: intent.hash,
          })

          this.logger.log(
            EcoLogMessage.fromDefault({
              message: `Indexed SVM intent ${intent.hash}`,
            }),
          )
        } catch (err) {
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: 'SolanaIndexer: failed',
              properties: { err },
            }),
          )
        }
      },
      {
        commitment: 'confirmed',
        encoding: 'base64',
      },
    )

    this.logger.log('Solana indexer subscribed.')
  }

  onModuleDestroy() {
    if (this.subId) this.connection.removeProgramAccountChangeListener(this.subId)
  }
}
