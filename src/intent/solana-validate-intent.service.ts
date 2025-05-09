import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue, JobsOptions } from 'bullmq'
import { Connection, PublicKey } from '@solana/web3.js'
import { Hex } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { QUEUES } from '@/common/redis/constants'
import { getIntentJobId } from '@/common/utils/strings'
import { fetchRawSvmIntentAccount } from '@/solana/utils'

const FUNDED_STATUS = 1

@Injectable()
export class SolanaValidateIntentService implements OnModuleInit {
  private readonly logger = new Logger(SolanaValidateIntentService.name)
  private intentJobConfig!: JobsOptions
  private connection!: Connection
  private routerProgram!: PublicKey

  constructor(
    private readonly ecoConfig: EcoConfigService,
    private readonly utils: UtilsIntentService,

    @InjectQueue(QUEUES.SOLANA_INTENT.queue)
    private readonly svmQueue: Queue,
  ) {}

  onModuleInit() {
    const solConfig = this.ecoConfig.getSolanaConfig()

    this.connection = new Connection(solConfig.rpc_url, 'confirmed')
    this.routerProgram = new PublicKey(solConfig.router_program_id)

    this.intentJobConfig = this.ecoConfig.getRedis().jobs.intentJobConfig
  }

  async validateIntent(intentHash: Hex): Promise<boolean> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `SolanaValidate: validateIntent`,
        properties: { intentHash },
      }),
    )

    const processData = await this.utils.getIntentProcessData(intentHash)
    if (!processData?.model) {
      this.logger.warn(`Intent ${intentHash} not found in DB yet`)
      return false
    }

    const rawIntent = await fetchRawSvmIntentAccount(
      intentHash,
      this.connection,
      this.logger,
      new PublicKey(this.routerProgram),
    )
    if (!rawIntent) return false

    if (
      rawIntent.status !== FUNDED_STATUS ||
      !rawIntent.tokens_funded ||
      !rawIntent.native_funded
    ) {
      this.logger.warn(`Intent ${intentHash} not funded or wrong status`)
      return false
    }

    if (rawIntent.reward.deadline < Date.now() / 1000) {
      this.logger.warn(`Intent ${intentHash} expired, the deadline is ${rawIntent.reward.deadline}`)
      return false
    }

    const destinationSolver = this.ecoConfig.getSolver(
      BigInt(rawIntent.route.destination_domain_id),
    )
    if (!destinationSolver) {
      this.logger.warn(
        `No solver configured for destination ${rawIntent.route.destination_domain_id}`,
      )
      return false
    }

    const jobId = getIntentJobId('validate', intentHash, processData.model.intent.logIndex)

    if (processData.model.chain !== 'SVM') {
      await this.svmQueue.add(QUEUES.SOURCE_INTENT.jobs.feasable_intent, intentHash, {
        jobId,
        ...this.intentJobConfig,
      })
    } else {
      await this.svmQueue.add(QUEUES.SOLANA_INTENT.jobs.feasable_intent, intentHash, {
        jobId,
        ...this.intentJobConfig,
      })
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `SolanaValidate: enqueued for feasability`,
        properties: { intentHash, jobId },
      }),
    )

    return true
  }
}
