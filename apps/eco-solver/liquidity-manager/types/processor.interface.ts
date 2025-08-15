import { Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import { TokenData, TokenDataAnalyzed, RebalanceRequest } from '@/liquidity-manager/types/types'

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
    analyzeTokens(walletAddress: string): Promise<{
      items: TokenDataAnalyzed[]
      surplus: { total: number; items: TokenDataAnalyzed[] }
      inrange: { total: number; items: TokenDataAnalyzed[] }
      deficit: { total: number; items: TokenDataAnalyzed[] }
    }>
    getOptimizedRebalancing(
      walletAddress: string,
      deficitToken: TokenDataAnalyzed,
      surplusTokens: TokenDataAnalyzed[]
    ): Promise<any[]>
    storeRebalancing(walletAddress: string, request: RebalanceRequest): Promise<void>
    startRebalancing(walletAddress: string, rebalances: RebalanceRequest[]): Promise<any>
    executeRebalancing(rebalanceData: any): Promise<void>
    analyzeToken(token: TokenData): any
  }
  readonly cctpProviderService: any
  readonly cctpv2ProviderService: any
  readonly everclearProviderService: any
}

// Alias for backwards compatibility  
export type LiquidityManagerProcessor = LiquidityManagerProcessorInterface