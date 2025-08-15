import { Logger } from '@nestjs/common'
import { Queue } from 'bullmq'

/**
 * Interface for the Liquidity Manager Processor to break circular dependencies
 * This allows job managers to type their processor parameter without importing the concrete class
 */
export interface LiquidityManagerProcessorInterface {
  readonly logger: Logger
  readonly queue: Queue
  readonly liquidityManagerService: {
    liquidityProviderManager: {
      execute(walletAddress: string, quote: any): Promise<any>
    }
  }
  readonly cctpProviderService: any
  readonly cctpv2ProviderService: any
  readonly everclearProviderService: any
}

// Alias for backwards compatibility  
export type LiquidityManagerProcessor = LiquidityManagerProcessorInterface