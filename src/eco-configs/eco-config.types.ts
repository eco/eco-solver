import { Hex } from 'viem'
import { z } from 'zod'
import {
  AwsCredentialSchema,
  CCTPConfigSchema,
  CCTPLiFiConfigSchema,
  CrowdLiquidityConfigSchema,
  EcoConfigSchema,
  FeeAlgoLinearSchema,
  FeeAlgoQuadraticSchema,
  FeeConfigTypeSchema,
  HyperlaneConfigSchema,
  IndexerConfigSchema,
  IntentSourceSchema,
  KmsConfigSchema,
  LiquidityManagerConfigSchema,
  SafeTypeSchema,
  SendBatchConfigSchema,
  SolverSchema,
  TargetContractSchema,
  WarpRoutesConfigSchema,
  WithdrawsConfigSchema,
} from './eco-config.schema'

// The config type that we store in json - derived from Zod schema
export type EcoConfigType = z.infer<typeof EcoConfigSchema>

/**
 * The config type for the safe multisig wallet
 */
export type SafeType = z.infer<typeof SafeTypeSchema>

/**
 * The config type for the redis section
 */
export type RedisConfig = EcoConfigType['redis']

/**
 * The config type for the intent section
 */
export type IntentConfig = EcoConfigType['intentConfigs']

/**
 * The config type for the fulfillment estimate section
 */
export type FulfillmentEstimateConfig = EcoConfigType['fulfillmentEstimate']

export type ServerConfig = EcoConfigType['server']

export type GasEstimationsConfig = EcoConfigType['gasEstimations']

export type QuotesConfig = EcoConfigType['quotesConfig']

export type SolverRegistrationConfig = EcoConfigType['solverRegistrationConfig']

/**
 * The config type for the aws credentials
 */
export type AwsCredential = z.infer<typeof AwsCredentialSchema>

/**
 * The config type for the aws kms
 */
export type KmsConfig = z.infer<typeof KmsConfigSchema>

export type FeeConfigType = z.infer<typeof FeeConfigTypeSchema>

/**
 * The config type for a whitelisted address for a set of chains
 * Chains must be explicitly listed in the chainIDs array
 */
export type FeeConfigDefaultType = FeeConfigType & {
  chainIDs: number[]
}

/**
 * The config type for fees for a whitelisted address
 */
export type FeeChainType = {
  [chainID: number]: FeeConfigType
  default?: FeeConfigDefaultType
}

/**
 * The config type for a fee record for whitelisted addresses. A default is
 * partial FeeConfigType, so that it can be overridden by chain specific fees.
 */
export type WhitelistFeeRecord = {
  [whitelistedWalletAddress: Hex]: Partial<FeeChainType>
}

/**
 * The config type for a single solver configuration
 */
export type Solver = z.infer<typeof SolverSchema>

/**
 * The fee algorithm types
 */
export type FeeAlgorithm = 'linear' | 'quadratic'

/**
 * The fee algorithm constant config types
 */
export type FeeAlgorithmConfig<T extends FeeAlgorithm> = T extends 'linear'
  ? {
      token: FeeAlgoLinear
      native: FeeAlgoLinear
    }
  : T extends 'quadratic'
    ? {
        token: FeeAlgoQuadratic
        native: FeeAlgoQuadratic
      }
    : never

export type FeeAlgoLinear = z.infer<typeof FeeAlgoLinearSchema>
export type FeeAlgoQuadratic = z.infer<typeof FeeAlgoQuadraticSchema>

/**
 * The config type for a supported target contract
 */
export type TargetContract = z.infer<typeof TargetContractSchema>

/**
 * The types of contracts that we support
 */
export type TargetContractType = 'erc20' | 'erc721' | 'erc1155'

/**
 * Defaults to append any provers in configs to the npm package
 */
export const ProverEcoRoutesProverAppend = 'append'

/**
 * The config type for a single prover source configuration
 */
export type IntentSource = z.infer<typeof IntentSourceSchema>

export type LiquidityManagerConfig = z.infer<typeof LiquidityManagerConfigSchema>

export type IndexerConfig = z.infer<typeof IndexerConfigSchema>

export type WithdrawsConfig = z.infer<typeof WithdrawsConfigSchema>

export type SendBatchConfig = z.infer<typeof SendBatchConfigSchema>

export type HyperlaneConfig = z.infer<typeof HyperlaneConfigSchema>

export type CrowdLiquidityConfig = z.infer<typeof CrowdLiquidityConfigSchema>

export type CCTPConfig = z.infer<typeof CCTPConfigSchema>

export type WarpRoutesConfig = z.infer<typeof WarpRoutesConfigSchema>

export type CCTPLiFiConfig = z.infer<typeof CCTPLiFiConfigSchema>
