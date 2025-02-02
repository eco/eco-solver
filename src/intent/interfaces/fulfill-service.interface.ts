import { Hex } from 'viem'

export interface IFulfillService {
  executeFulfillIntent(intentHash: Hex): Promise<void>
}
