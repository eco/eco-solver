import { Queue } from 'bullmq'

// Legacy interface - use LiquidityManagerProcessorInterface from types/processor.interface.ts instead
export { LiquidityManagerProcessorInterface as ILiquidityManagerProcessor } from '@/liquidity-manager/types/processor.interface'

export interface IExecuteCCTPV2MintJobManager {
  start(queue: Queue, data: any): Promise<void>
}
