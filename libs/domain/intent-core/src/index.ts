// Domain Types
export * from './types/intent.types'
export * from './types/fulfillment.types'

// Domain Models
export * from './models/intent.model'

// Domain Service Interfaces
export * from './services/intent.service.interface'

// Domain Services (Implementations)
export * from './services/intent-creation.service'

// Domain Utilities
export * from './utils/intent.utils'

// Re-exports of commonly used types from eco-adapter
export type { IntentType, RouteType, RewardType } from '@eco/foundation-eco-adapter'