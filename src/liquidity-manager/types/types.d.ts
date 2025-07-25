import { TokenBalance, TokenConfig } from '@/balance/types'
import * as LiFi from '@lifi/sdk'
import { Hex } from 'viem'
import { Execute as RelayQuote } from '@reservoir0x/relay-sdk'
import { StargateQuote } from '@/liquidity-manager/services/liquidity-providers/Stargate/types/stargate-quote.interface'
import { Route as SquidRoute } from '@0xsquid/sdk'

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
type RelayStrategyContext = RelayQuote
type StargateStrategyContext = StargateQuote
type SquidStrategyContext = SquidRoute

interface CCTPV2StrategyContext {
  transferType: 'standard' | 'fast'
  fee: bigint
  feeBps: number
  minFinalityThreshold: number
  messageHash?: Hex
  messageBody?: Hex
}

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
  gasEstimation?: {
    sourceChainGas: bigint
    destinationChainGas: bigint
    totalGasUSD: number
    gasWarnings: string[]
  }
  id?: string
}

interface PublicNegativeIntentContext {
  intentHashes: Hex[]
}

type Strategy =
  | 'LiFi'
  | 'CCTP'
  | 'WarpRoute'
  | 'CCTPLiFi'
  | 'Relay'
  | 'Stargate'
  | 'Squid'
  | 'CCTPV2'
  | 'PublicNegativeIntent'

type StrategyContext<S extends Strategy = Strategy> = S extends 'LiFi'
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
                : S extends 'PublicNegativeIntent'
                  ? PublicNegativeIntentContext
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
  id?: string
}

interface RebalanceRequest {
  token: TokenData
  quotes: RebalanceQuote[]
}
