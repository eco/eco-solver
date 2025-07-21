/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { FulfillIntentJobData } from '@/intent/fulfillment-processor/job-managers/fulfill-intent-job-manager'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'
import { FulfillmentProcessorQueue, FulfillmentProcessorQueueType } from '@/intent/fulfillment-processor/queues/fulfillment-processor.queue'
import { FulfillsConfig } from '@/eco-configs/eco-config.types'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentProcessingJobData } from '@/intent/interfaces/intent-processing-job-data.interface'
import { IntentFilter, IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import * as _ from 'lodash'

@Injectable()
export class FulfillmentProcessorService implements OnApplicationBootstrap {
  private logger = new Logger(FulfillmentProcessorService.name)

  private fulfillsConfig: FulfillsConfig
  private readonly fulfillmentProcessorQueue: FulfillmentProcessorQueue

  constructor(
    @InjectQueue(FulfillmentProcessorQueue.queueName)
    queue: FulfillmentProcessorQueueType,
    private readonly ecoConfigService: EcoConfigService,
    private readonly fulfillIntentService: FulfillIntentService,
    private readonly intentSourceRepository: IntentSourceRepository,
  ) {
    this.fulfillmentProcessorQueue = new FulfillmentProcessorQueue(queue)
  }

  async onApplicationBootstrap() {
    this.fulfillsConfig = this.ecoConfigService.getFulfillsConfig()

    await this.fulfillmentProcessorQueue.startFulfillsCronJob(
      this.fulfillsConfig.intervalDuration,
    )
  }

  async getNextFulfills(): Promise<void> {

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `getNextFulfills`,
      }),
    )

    // Get pending intents from the repository, grouped by chainId
    const pendingIntents = await this.getIntentsForFulfillment()

    for (const [chainId, intents] of Object.entries(pendingIntents)) {
      const chunks = _.chunk(intents, this.fulfillsConfig.chunkSize)

      for (const chunk of chunks) {
        await this.fulfillmentProcessorQueue.addFulfillIntentsJob({
          chainId: Number(chainId),
          intents: chunk,
        })
      }
    }
  }

  async executeFulfills(data: FulfillIntentJobData) {
    const { chainId, intents } = data

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `executeFulfills`,
        properties: {
          chainId,
          intents,
        },
      }),
    )

    for (const intent of intents) {
      try {
        await this.fulfillIntentService.fulfill(intent)
      } catch (ex) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `executeFulfills: failed to fulfill intent ${intent.intentHash}`,
            properties: {
              chainId,
              intent,
              error: ex.message || ex,
            },
          }),
        )
      }
    }
  }

  private async getIntentsForFulfillment(): Promise<Record<number, IntentProcessingJobData[]>> {
    const baseQuery = {
      requireNonExpired: true,
      requireTransferSelector: true,
      requireZeroCallValue: true,
    }

    const pendingIntentsQuery: IntentFilter = {
      ...baseQuery,
      status: 'PENDING',
    }

    const retryableFailedIntentsQuery: IntentFilter = {
      ...baseQuery,
      status: 'FAILED',
      updatedBefore: new Date(new Date().getTime() - this.fulfillsConfig.retryDelay),
    }

    const pendingIntents = await this.intentSourceRepository.filterIntents(pendingIntentsQuery)
    const retryableFailedIntents = await this.intentSourceRepository.filterIntents(retryableFailedIntentsQuery)
    const intentSourceModels = [...pendingIntents, ...retryableFailedIntents]

    // Final dedupe in case the status changed between queries!
    const uniqueIntentSourceModels = _.uniqBy(intentSourceModels, (model) => model.intent.hash)

    const groupedByChainId: Record<number, IntentProcessingJobData[]> = {}

    for (const intentSourceModel of uniqueIntentSourceModels) {
      const chainId = Number(intentSourceModel.intent.route.source)

      if (!groupedByChainId[chainId]) {
        groupedByChainId[chainId] = []
      }

      groupedByChainId[chainId].push({
        intentHash: intentSourceModel.intent.hash,
      })
    }

    return groupedByChainId
  }
}
