import { Injectable, Logger } from '@nestjs/common'
import { Hex } from 'viem'
import { ChainDataFetcherService } from '@libs/integrations'
import { IndexerDomainService } from '@libs/domain'
import { SendBatchData, BatchWithdrawGasless, BatchWithdraws } from '@libs/shared'

@Injectable()
export class IndexerService {
  private logger = new Logger(IndexerService.name)

  constructor(
    private readonly chainDataFetcher: ChainDataFetcherService,
    private readonly indexerDomain: IndexerDomainService
  ) {}

  async getNextBatchWithdrawals(intentSourceAddr?: Hex): Promise<BatchWithdraws[]> {
    const data = await this.chainDataFetcher.fetchNextBatchWithdrawals(intentSourceAddr)
    
    // Use domain service to filter gasless intents
    return this.indexerDomain.filterGaslessIntents(data)
  }

  async getNextSendBatch(intentSourceAddr?: Hex): Promise<SendBatchData[]> {
    return this.chainDataFetcher.fetchNextSendBatch(intentSourceAddr)
  }
}
