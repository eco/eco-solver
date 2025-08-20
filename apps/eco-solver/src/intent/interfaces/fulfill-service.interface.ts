import { Solver } from '@eco-solver/eco-configs/eco-config.types'
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema'
import { Hex } from "viem"

export interface IFulfillService {
  fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex>
}
