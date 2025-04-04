import { Injectable, Logger } from '@nestjs/common'
import { Hex } from 'viem'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { EcoError } from '@/common/errors/eco-error'
import { IndexerConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BatchWithdrawsDTO } from '@/indexer/interfaces/batch-withdraws.interface'
import { SendBatchData } from '@/indexer/interfaces/send-batch-data.interface'

@Injectable()
export class IndexerService {
  private logger = new Logger(IndexerService.name)

  private config: IndexerConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {
    this.config = this.ecoConfigService.getIndexer()
  }

  async getNextBatchWithdrawals(intentSourceAddr?: Hex): Promise<BatchWithdrawsDTO[]> {
    const searchParams = { evt_log_address: intentSourceAddr }
    const rawData = await this.fetch<BatchWithdrawsDTO[]>('/intents/nextBatchWithdrawals', {
      searchParams,
    })

    const dtoArray = plainToInstance(BatchWithdrawsDTO, rawData)
    const validations = await Promise.all(dtoArray.map((item) => validate(item)))

    // If there is an error, a data type is invalid
    const hasErrors = validations.some((errors) => errors.length > 0)
    if (hasErrors) {
      throw EcoError.IndexerInvalidDataError
    }

    return dtoArray
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
