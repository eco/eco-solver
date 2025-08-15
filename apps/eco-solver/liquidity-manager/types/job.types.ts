import { Job } from 'bullmq'
import { Hex } from 'viem'
import { LiFiStrategyContext } from './types'
import { LiquidityManagerJobName } from '@/liquidity-manager/constants/job-names'
import { LiquidityManagerQueueDataType } from '@/liquidity-manager/types/queue.types'

// Base type for all liquidity manager jobs
export type BaseLiquidityManagerJob<
  TName extends LiquidityManagerJobName = LiquidityManagerJobName,
  TData extends LiquidityManagerQueueDataType = LiquidityManagerQueueDataType,
  TReturn = unknown,
> = Job<TData, TReturn, TName>

// Specific job data types
export interface CheckCCTPAttestationJobData extends LiquidityManagerQueueDataType {
  messageHash: Hex
  sourceChainId: number
  destinationChainId: number
  attemptID?: string
  cctpLiFiContext?: {
    destinationSwapQuote: LiFiStrategyContext
    walletAddress: string
    originalTokenOut: {
      address: Hex
      chainId: number
      decimals: number
    }
  }
}

export interface ExecuteCCTPMintJobData extends LiquidityManagerQueueDataType {
  destinationChainId: number
  messageHash: Hex
  messageBody: Hex
  attestation: Hex
  cctpLiFiContext?: {
    destinationSwapQuote: LiFiStrategyContext
    walletAddress: string
    originalTokenOut: {
      address: Hex
      chainId: number
      decimals: number
    }
  }
}

export interface CheckCCTPV2AttestationJobData extends LiquidityManagerQueueDataType {
  messageHash: Hex
  sourceChainId: number
  destinationChainId: number
  attemptID?: string
  walletAddress: string
}

export interface ExecuteCCTPV2MintJobData extends LiquidityManagerQueueDataType {
  destinationChainId: number
  messageHash: Hex
  messageBody: Hex
  attestation: Hex
  walletAddress: string
}

export interface CheckEverclearIntentJobData extends LiquidityManagerQueueDataType {
  messageHash: Hex
  sourceChainId: number
  destinationChainId: number
  attemptID?: string
}

export interface CheckBalancesJobData extends LiquidityManagerQueueDataType {
  wallet: string
}

export interface CCTPLiFiDestinationSwapJobData extends LiquidityManagerQueueDataType {
  messageHash: Hex
  messageBody: Hex
  attestation: Hex
  destinationChainId: number
  destinationSwapQuote: LiFiStrategyContext
  walletAddress: string
  originalTokenOut: {
    address: Hex
    chainId: number
    decimals: number
  }
  cctpTransactionHash?: Hex
  retryCount?: number
  [key: string]: unknown // Index signature for BullMQ compatibility
}

// Specific job types
export type CheckCCTPAttestationJobType = Job<
  CheckCCTPAttestationJobData,
  unknown,
  LiquidityManagerJobName.CHECK_CCTP_ATTESTATION
>

export type ExecuteCCTPMintJobType = Job<
  ExecuteCCTPMintJobData,
  Hex,
  LiquidityManagerJobName.EXECUTE_CCTP_MINT
>

export type CCTPLiFiDestinationSwapJobType = Job<
  CCTPLiFiDestinationSwapJobData,
  { txHash: Hex; finalAmount: string },
  LiquidityManagerJobName.CCTP_LIFI_DESTINATION_SWAP
>

export type CheckCCTPV2AttestationJobType = Job<
  CheckCCTPV2AttestationJobData,
  unknown,
  LiquidityManagerJobName.CHECK_CCTPV2_ATTESTATION
>

export type ExecuteCCTPV2MintJobType = Job<
  ExecuteCCTPV2MintJobData,
  Hex,
  LiquidityManagerJobName.EXECUTE_CCTPV2_MINT
>

export type CheckEverclearIntentJobType = Job<
  CheckEverclearIntentJobData,
  unknown,
  LiquidityManagerJobName.CHECK_EVERCLEAR_INTENT
>

export type CheckBalancesJobType = Job<
  CheckBalancesJobData,
  unknown,
  LiquidityManagerJobName.CHECK_BALANCES
>

// Union type of all liquidity manager jobs
export type LiquidityManagerJobType =
  | CheckCCTPAttestationJobType
  | ExecuteCCTPMintJobType
  | CCTPLiFiDestinationSwapJobType
  | CheckCCTPV2AttestationJobType
  | ExecuteCCTPV2MintJobType
  | CheckEverclearIntentJobType
  | CheckBalancesJobType

// Alias for backwards compatibility
export type LiquidityManagerJob = LiquidityManagerJobType