import { Injectable, Logger } from '@nestjs/common'
import { Hex } from 'viem'
import { IndexerConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import {
  BatchWithdrawGasless,
  BatchWithdraws,
} from '@/indexer/interfaces/batch-withdraws.interface'
import { SendBatchData } from '@/indexer/interfaces/send-batch-data.interface'

@Injectable()
export class IndexerService {
  private logger = new Logger(IndexerService.name)

  private config: IndexerConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {
    this.config = this.ecoConfigService.getIndexer()
  }

  async getNextBatchWithdrawals(
    intentSourceAddr?: Hex,
  ): Promise<(BatchWithdraws | BatchWithdrawGasless)[]> {
    const searchParams = { evt_log_address: intentSourceAddr }
    return await this.fetch<(BatchWithdraws | BatchWithdrawGasless)[]>(
      '/intents/nextBatchWithdrawals',
      { searchParams },
    )
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
}
