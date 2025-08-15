import { Solver } from '@eco/infrastructure-config'
import { IntentSourceModel } from '@eco/infrastructure-database'
import { Hex } from 'viem'

export interface IFulfillService {
  fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex>
}
