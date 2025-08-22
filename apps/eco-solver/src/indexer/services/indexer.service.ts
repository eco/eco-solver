import { Injectable, Logger } from '@nestjs/common'
import { Hex } from 'viem'
import { IndexerConfig } from '@libs/solver-config'
import { EcoConfigService } from '@libs/solver-config'
import {
  BatchWithdrawGasless,
  BatchWithdraws,
} from '@eco-solver/indexer/interfaces/batch-withdraws.interface'
import { SendBatchData } from '@eco-solver/indexer/interfaces/send-batch-data.interface'

@Injectable()
export class IndexerService {
  private logger = new Logger(IndexerService.name)

  private config: IndexerConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {
    this.config = this.ecoConfigService.getIndexer()
  }

  async getNextBatchWithdrawals(intentSourceAddr?: Hex): Promise<BatchWithdraws[]> {
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

  getNextSendBatch(intentSourceAddr?: Hex) {
    const searchParams = { evt_log_address: intentSourceAddr }
    return this.fetch<SendBatchData[]>('/intents/nextBatch', { searchParams })
  }

  private async fetch<Data>(
    endpoint: string,
    opts?: RequestInit & { searchParams?: Record<string, string | undefined> },
  ): Promise<Data> {
    try {
      const { searchParams, ...fetchOpts } = opts ?? {}
      const url = new URL(endpoint, this.config.url)

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
      this.logger.error('Indexer: Fetch error', error)
      throw error
    }
  }

  private isGaslessIntent(
    record: BatchWithdraws | BatchWithdrawGasless,
  ): record is BatchWithdrawGasless {
    return 'intentHash' in record.intent
  }
}
