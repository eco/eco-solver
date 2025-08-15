import { TokenBalance, TokenConfig, Strategy } from '@eco/shared-types'
import * as LiFi from '@lifi/sdk'
import { Hex } from 'viem'
import { Execute as RelayQuote } from '@reservoir0x/relay-sdk'
import { StargateQuote } from '../services/liquidity-providers/Stargate/types/stargate-quote.interface'
// import { Route as SquidRoute } from '@0xsquid/sdk' // TODO: Fix Squid SDK import
type SquidRoute = any // Temporary placeholder

import { TokenState } from './token-state.enum'

export interface TokenData {
  chainId: number
  config: TokenConfig
  balance: TokenBalance
}

export interface TokenBalanceAnalysis {
  target: bigint
  current: bigint
  minimum: bigint
  maximum: bigint
}

export interface TokenAnalysis {
  state: TokenState
  diff: number
  targetSlippage: { min: bigint; max: bigint }
  balance: TokenBalanceAnalysis
}

export interface TokenDataAnalyzed extends TokenData {
  analysis: TokenAnalysis
}

// Strategy context

export type LiFiStrategyContext = LiFi.Route
type CCTPStrategyContext = undefined
type WarpRouteStrategyContext = undefined
type RelayStrategyContext = RelayQuote
type StargateStrategyContext = StargateQuote
type SquidStrategyContext = SquidRoute
type EverclearStrategyContext = undefined

export interface CCTPV2StrategyContext {
  transferType: 'standard' | 'fast'
  fee: bigint
  feeBps: number
  minFinalityThreshold: number
  messageHash?: Hex
  messageBody?: Hex
}

// CCTPLiFi strategy context for tracking multi-step operations
export interface CCTPLiFiStrategyContext {
  sourceSwapQuote?: LiFiStrategyContext // LiFi route for token → USDC
  cctpTransfer: {
    sourceChain: number
    destinationChain: number
    amount: bigint
    messageHash?: Hex
    messageBody?: Hex
  }
  destinationSwapQuote?: LiFiStrategyContext // LiFi route for USDC → token
  steps: ('sourceSwap' | 'cctpBridge' | 'destinationSwap')[]
  gasEstimation?: {
    sourceChainGas: bigint
    destinationChainGas: bigint
    totalGasUSD: number
    gasWarnings: string[]
  }
  id?: string
}

// Strategy type is now imported from shared types
// Re-export for backward compatibility
export { Strategy } from '@eco/shared-types'
export type StrategyContext<S extends Strategy = Strategy> = S extends 'LiFi'
  ? LiFiStrategyContext
  : S extends 'CCTP'
    ? CCTPStrategyContext
    : S extends 'WarpRoute'
      ? WarpRouteStrategyContext
      : S extends 'Relay'
        ? RelayStrategyContext
        : S extends 'Stargate'
          ? StargateStrategyContext
          : S extends 'CCTPLiFi'
            ? CCTPLiFiStrategyContext
            : S extends 'Squid'
              ? SquidStrategyContext
              : S extends 'CCTPV2'
                ? CCTPV2StrategyContext
                : S extends 'Everclear'
                  ? EverclearStrategyContext
                  : never

// Quote

export interface RebalanceQuote<S extends Strategy = Strategy> {
  amountIn: bigint
  amountOut: bigint
  slippage: number
  tokenIn: TokenData
  tokenOut: TokenData
  strategy: S
  context: StrategyContext<S>
  id?: string
}

export interface RebalanceRequest {
  token: TokenData
  quotes: RebalanceQuote[]
}
