import { TokenBalance, TokenConfig } from '@/balance/types'
import * as LiFi from '@lifi/sdk'
import { Hex } from 'viem'

type TokenState = 'DEFICIT' | 'SURPLUS' | 'IN_RANGE'

interface TokenData {
  chainId: number
  config: TokenConfig
  balance: TokenBalance
}

interface TokenBalanceAnalysis {
  target: bigint
  current: bigint
  minimum: bigint
  maximum: bigint
}

interface TokenAnalysis {
  state: TokenState
  diff: number
  targetSlippage: { min: bigint; max: bigint }
  balance: TokenBalanceAnalysis
}

interface TokenDataAnalyzed extends TokenData {
  analysis: TokenAnalysis
}

// Strategy context

type LiFiStrategyContext = LiFi.Route
type CCTPStrategyContext = undefined
type WarpRouteStrategyContext = undefined

// CCTPLiFi strategy context for tracking multi-step operations
interface CCTPLiFiStrategyContext {
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
  totalSlippage: number
  gasEstimation?: {
    sourceChainGas: bigint
    destinationChainGas: bigint
    totalGasUSD: number
    gasWarnings: string[]
  }
}

type Strategy = 'LiFi' | 'CCTP' | 'WarpRoute' | 'CCTPLiFi'
type StrategyContext<S extends Strategy = Strategy> = S extends 'LiFi'
  ? LiFiStrategyContext
  : S extends 'CCTP'
    ? CCTPStrategyContext
    : S extends 'WarpRoute'
      ? WarpRouteStrategyContext
      : S extends 'CCTPLiFi'
        ? CCTPLiFiStrategyContext
        : never

// Quote

interface RebalanceQuote<S extends Strategy = Strategy> {
  amountIn: bigint
  amountOut: bigint
  slippage: number
  tokenIn: TokenData
  tokenOut: TokenData
  strategy: S
  context: StrategyContext<S>
}

interface RebalanceRequest {
  token: TokenData
  quotes: RebalanceQuote[]
}
