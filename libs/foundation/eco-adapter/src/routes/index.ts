// Re-export all routes functionality from @eco-foundation/routes-ts
export * from '@eco-foundation/routes-ts'

// Commonly used exports for convenience
export type { IntentType, RouteType, RewardType, EcoChainConfig } from '@eco-foundation/routes-ts'

export { EcoProtocolAddresses } from '@eco-foundation/routes-ts'

export {
  IntentSourceAbi,
  InboxAbi,
  IProverAbi,
  IMessageBridgeProverAbi,
  hashIntent,
  hashRoute,
  hashReward,
  encodeIntent,
  encodeRoute,
  encodeReward,
} from '@eco-foundation/routes-ts'
