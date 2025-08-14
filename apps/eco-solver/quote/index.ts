// Core quote module exports
export { QuoteModule } from './quote.module'

// Repository exports
export { QuoteRepository } from './quote.repository'

// NOTE: QuoteService is NOT exported from this barrel to prevent circular dependencies
// Import directly: import { QuoteService } from '@/quote/quote.service'

// Re-export specific barrel exports to maintain API
export * from './dto'
export * from './schemas'
export * from './enums'
export * from './interfaces'