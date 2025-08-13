// Unified Eco Foundation Adapter
// This library provides a single entry point for all @eco-foundation packages

// Chains functionality
export * from './chains'

// Routes functionality  
export * from './routes'

// KMS functionality
export * from './kms'

// Convenience re-exports for commonly used functionality
export {
  // Chain utilities
  EcoRoutesChains,
} from './chains'

export {
  // Route ABIs and utilities
  IntentSourceAbi,
  InboxAbi, 
  IProverAbi,
  IMessageBridgeProverAbi,
  
  // Route types
  IntentType,
  RouteType,
  RewardType,
  EcoChainConfig,
  EcoProtocolAddresses,
  
  // Hashing and encoding utilities
  hashIntent,
  hashRoute, 
  hashReward,
  encodeIntent,
  encodeRoute,
  encodeReward,
} from './routes'

export {
  // KMS core functionality
  Signer,
  KMSWallets,
  KMSProviderAWS,
} from './kms'