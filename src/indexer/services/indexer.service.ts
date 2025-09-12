import { Injectable } from '@nestjs/common'
import { Hex } from 'viem'
import { IndexerConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'
import {
  BatchWithdrawGasless,
  BatchWithdraws,
} from '@/indexer/interfaces/batch-withdraws.interface'
import { SendBatchData } from '@/indexer/interfaces/send-batch-data.interface'

@Injectable()
export class IndexerService {
  private logger = new GenericOperationLogger('IndexerService')

  private config: IndexerConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {
    this.config = this.ecoConfigService.getIndexer()
  }

  @LogOperation('get_next_batch_withdrawals', GenericOperationLogger)
  async getNextBatchWithdrawals(@LogContext intentSourceAddr?: Hex): Promise<BatchWithdraws[]> {
    const searchParams = { evt_log_address: intentSourceAddr }
    const data = await this.fetch<(BatchWithdraws | BatchWithdrawGasless)[]>(
      '/intents/nextBatchWithdrawals',
      { searchParams },
    )

    const withdrawals: BatchWithdraws[] = []
    data.forEach((record) => {
      if (!this.isGaslessIntent(record)) {
        withdrawals.push(record)
      }
    })

    return withdrawals
  }

  @LogOperation('get_next_send_batch', GenericOperationLogger)
  getNextSendBatch(@LogContext intentSourceAddr?: Hex) {
    const searchParams = { evt_log_address: intentSourceAddr }
    return this.fetch<SendBatchData[]>('/intents/nextBatch', { searchParams })
  }

  private async fetch<Data>(
    endpoint: string,
    opts?: RequestInit & { searchParams?: Record<string, string | undefined> },
  ): Promise<Data> {
    const { searchParams, ...fetchOpts } = opts ?? {}
    const url = new URL(endpoint, this.config.url)

    try {
      if (searchParams) {
        for (const param in searchParams) {
          if (searchParams[param]) {
            url.searchParams.set(param, searchParams[param])
          }
        }
      }

      const response = await fetch(url.toString(), { method: 'GET', ...fetchOpts })
      return await response.json()
    } catch (error) {
      this.logger.error(
        { operationType: 'api_call', status: 'failed' },
        'Indexer: Fetch error',
        error,
        { endpoint, url: url.toString() },
      )
      throw error
    }
  }

  private isGaslessIntent(
    record: BatchWithdraws | BatchWithdrawGasless,
  ): record is BatchWithdrawGasless {
    return 'intentHash' in record.intent
  }
}
