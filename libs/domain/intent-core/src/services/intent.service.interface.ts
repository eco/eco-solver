import { Hex } from 'viem'
import { CreateIntentParams, IntentStatus, IntentMetadata } from '../types/intent.types'
import { FulfillmentRequest, FulfillmentResult, FulfillmentEstimate } from '../types/fulfillment.types'

// Domain service interfaces for intent management
export interface IIntentCreationService {
  createIntent(params: CreateIntentParams): Promise<Hex>
  validateIntent(params: CreateIntentParams): Promise<boolean>
  estimateCreationCost(params: CreateIntentParams): Promise<bigint>
}

export interface IIntentFulfillmentService {
  fulfillIntent(request: FulfillmentRequest): Promise<FulfillmentResult>
  estimateFulfillment(intentHash: Hex): Promise<FulfillmentEstimate[]>
  canFulfill(intentHash: Hex, solver: Hex): Promise<boolean>
}

export interface IIntentQueryService {
  getIntentStatus(hash: Hex): Promise<IntentStatus>
  getIntentMetadata(hash: Hex): Promise<IntentMetadata>
  getIntentsByCreator(creator: Hex): Promise<Hex[]>
  getActiveIntents(chainId: bigint): Promise<Hex[]>
}

export interface IIntentValidationService {
  validateIntentStructure(params: CreateIntentParams): Promise<boolean>
  validateSolver(solver: Hex, chainId: bigint): Promise<boolean>
  validateDeadline(deadline: bigint): Promise<boolean>
  validateTokenBalances(params: CreateIntentParams): Promise<boolean>
}