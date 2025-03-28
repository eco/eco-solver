import { Solver } from '@/eco-configs/eco-config.types'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { Hex } from 'viem'

export interface IFulfillService {
  fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex>
}
