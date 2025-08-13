// Domain library - minimal interface-only version
// This avoids TypeScript compilation issues with missing dependencies

// Core domain service interfaces
export interface IDomainService {
  processEntity<T>(entity: T): Promise<T>
}

export interface IRepository<T> {
  findById(id: string): Promise<T | null>
  save(entity: T): Promise<T>
  delete(id: string): Promise<void>
}

export interface IIntentService {
  validateIntent(intent: any): Promise<boolean>
  processIntent(intent: any): Promise<any>
}

export interface IQuoteService {
  generateQuote(params: any): Promise<any>
  validateQuote(quote: any): Promise<boolean>
}

export interface IChainIndexerService {
  indexEvents(chain: string, fromBlock: number): Promise<void>
}
