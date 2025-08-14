// Domain Types - explicit to prevent circular dependencies
export * from './types/intent.types'
export * from './types/fulfillment.types'

// Domain Models - explicit to prevent circular dependencies
export { IntentModel } from './models/intent.model'

// Domain Service Interfaces - explicit to prevent circular dependencies
export { IntentServiceInterface } from './services/intent.service.interface'

// Domain Services (Implementations) - explicit to prevent circular dependencies
export { IntentCreationService } from './services/intent-creation.service'

// Domain Utilities - explicit to prevent circular dependencies
export * from './utils/intent.utils'

// Re-exports of commonly used types from eco-adapter
export type { IntentType, RouteType, RewardType } from '@eco/foundation-eco-adapter'
