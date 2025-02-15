import { Injectable, Logger } from '@nestjs/common'
import { IndexerConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BatchWithdraws } from '@/indexer/interfaces/batch-withdraws.interface'
import { Hex } from 'viem'

@Injectable()
export class IndexerService {
  private logger = new Logger(IndexerService.name)

  private config: IndexerConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {
    this.config = this.ecoConfigService.getIndexer()
  }

  getNextBatchWithdrawals(intentSourceAddr?: Hex) {
    const searchParams = { evt_log_address: intentSourceAddr }
    return this.fetch<BatchWithdraws[]>('/intents/nextBatchWithdrawals', { searchParams })
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
