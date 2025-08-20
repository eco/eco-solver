import { Solver } from '@libs/eco-solver-config'
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema'
import { Hex } from 'viem'

export interface IFulfillService {
  fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex>
}
