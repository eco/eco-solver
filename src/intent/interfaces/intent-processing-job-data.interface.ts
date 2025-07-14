import { Hex } from 'viem'

export interface IntentProcessingJobData {
  intentHash: Hex
  isNegativeIntent?: boolean
}
