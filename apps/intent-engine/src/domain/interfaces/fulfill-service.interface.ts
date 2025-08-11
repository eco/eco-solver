export interface IFulfillService {
  fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex>
}
