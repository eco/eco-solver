// Database library - minimal interface-only version
// This avoids TypeScript compilation issues with missing dependencies

// Core database service interfaces
export interface IDatabaseService {
  connect(): Promise<void>
  disconnect(): Promise<void>
}

export interface IRepository<T> {
  create(entity: T): Promise<T>
  findById(id: string): Promise<T | null>
  findAll(): Promise<T[]>
  update(id: string, entity: Partial<T>): Promise<T | null>
  delete(id: string): Promise<boolean>
}

export interface IIntentRepository {
  findByHash(hash: string): Promise<any>
  saveIntent(intent: any): Promise<any>
}

export interface IQuoteRepository {
  findByIntentHash(intentHash: string): Promise<any[]>
  saveQuote(quote: any): Promise<any>
}

export interface IMigrationService {
  runMigrations(): Promise<void>
}
