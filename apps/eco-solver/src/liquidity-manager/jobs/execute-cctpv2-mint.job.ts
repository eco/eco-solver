import { Queue } from 'bullmq'
import { Hex } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from './liquidity-manager.job'
import { LiquidityManagerJobName } from '../queues/liquidity-manager.queue'
import { CCTPV2StrategyContext } from '../types/types'
import { LiquidityManagerProcessor } from '../processors/eco-protocol-intents.processor'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { deserialize, Serialize } from '../../common/utils/serialize'

export interface ExecuteCCTPV2MintJobData {
  destinationChainId: number
  messageHash: Hex
  messageBody: Hex
  attestation: Hex
  context: Serialize<CCTPV2StrategyContext>
  id?: string
  [key: string]: unknown
}

export type ExecuteCCTPV2MintJob = LiquidityManagerJob<
  LiquidityManagerJobName.EXECUTE_CCTPV2_MINT,
  ExecuteCCTPV2MintJobData,
  Hex
>

export class ExecuteCCTPV2MintJobManager extends LiquidityManagerJobManager<ExecuteCCTPV2MintJob> {
  static async start(queue: Queue, data: ExecuteCCTPV2MintJob['data']): Promise<void> {
    await queue.add(LiquidityManagerJobName.EXECUTE_CCTPV2_MINT, data, {
      jobId: `${ExecuteCCTPV2MintJobManager.name}-${data.messageHash}`,
      removeOnComplete: false,
      removeOnFail: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10_000,
      },
    })
  }

  is(job: LiquidityManagerJob): job is ExecuteCCTPV2MintJob {
    return job.name === LiquidityManagerJobName.EXECUTE_CCTPV2_MINT
  }

  async process(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor): Promise<Hex> {
    const { destinationChainId, messageBody, attestation } = job.data
    processor.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPV2: Processing V2 mint job',
        id: job.data.id,
        properties: {
          destinationChainId,
          messageLength: messageBody.length,
          attestationLength: attestation.length,
        },
      }),
    )
    deserialize(job.data.context) // Deserialize for consistency, though not used here
    return processor.cctpv2ProviderService.receiveV2Message(
      destinationChainId,
      messageBody,
      attestation,
      job.data.id,
    )
  }

  async onComplete(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor) {
    processor.logger.log(
      EcoLogMessage.withId({
        message: `CCTPV2: ExecuteCCTPV2MintJob: Completed!`,
        id: job.data.id,
        properties: {
          chainId: job.data.destinationChainId,
          txHash: job.returnvalue,
          id: job.data.id,
        },
      }),
    )
  }

  onFailed(job: ExecuteCCTPV2MintJob, processor: LiquidityManagerProcessor, error: unknown) {
    processor.logger.error(
      EcoLogMessage.withId({
        message: `CCTPV2: ExecuteCCTPV2MintJob: Failed`,
        id: job.data.id,
        properties: { error: (error as any)?.message ?? error, data: job.data },
      }),
    )
  }
}
