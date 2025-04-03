import { TokenBalance, TokenConfig } from '@/balance/types'
import * as LiFi from '@eco-foundation/lifi-sdk'

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

type Strategy = 'LiFi'
type StrategyContext<S extends Strategy = Strategy> = S extends 'LiFi' ? LiFiStrategyContext : never

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
