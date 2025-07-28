import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Hex } from 'viem'
import { Injectable } from '@nestjs/common'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { TargetCallDataModel } from '@/intent/schemas/intent-call-data.schema'
import { TokenAmountDataModel } from '@/intent/schemas/intent-token-amount.schema'

/*
Selector -  4 bytes (8 chars)
address  - 32 bytes (64 chars)
uint256  - 32 bytes (64 chars)
Total    - 68 bytes (136 bytes)
*/

const MinCallDataLength = 138 // 0x + 136 bytes as described above

export interface RankedIntent {
  intentSource: IntentSourceModel
  slippage: number
  rewardAmount: bigint
  routeAmount: bigint
  netDiff: bigint
}

export interface IntentRankingResult {
  ranked: RankedIntent[]
  skipped: { intentSource: IntentSourceModel; reason: string }[]
}

export interface NegativeIntentAnalysisResult {
  intentSource: IntentSourceModel
  isNegative: boolean
  rewardAmount: bigint
  routeAmount: bigint
}

@Injectable()
export class NegativeIntentAnalyzerService {
  private logger = new EcoLogger(NegativeIntentAnalyzerService.name)

  constructor(private readonly ecoConfigService: EcoConfigService) {}

  /**
   * Computes slippage as a number between 0 and 1.
   * Uses bigint math to avoid precision loss from large values (e.g., wei).
   *
   * @param rewardAmount - The "output" amount (reward) in bigint
   * @param routeAmount - The "input" amount (route) in bigint
   * @param scale - Optional scale factor (default 1_000_000n for 6 decimal places)
   * @returns slippage as a number (e.g., 0.15 for 15% slippage)
   */
  static getSlippage(
    rewardAmount: bigint,
    routeAmount: bigint,
    scale: bigint = 1_000_000n,
  ): number {
    if (routeAmount === 0n) {
      return Infinity // or throw, depending on use case
    }

    const ratio = (rewardAmount * scale) / routeAmount
    return Number(scale - ratio) / Number(scale)
  }

  isNegativeIntent(intentSource: IntentSourceModel): boolean {
    try {
      const { response: analysisResult, error } = this.analyzeIntent(intentSource)

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `isNegativeIntent: error`,
            properties: {
              intentHash: intentSource.intent.hash,
              error: error.message || error,
            },
          }),
        )

        return false
      }

      return analysisResult!.isNegative
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `isNegativeIntent: Failed to analyze intent ${intentSource.intent.hash}`,
          properties: {
            error: ex.message || ex,
            intentHash: intentSource.intent.hash,
          },
        }),
      )
      return false
    }
  }

  analyzeIntent(intentSource: IntentSourceModel): EcoResponse<NegativeIntentAnalysisResult> {
    const intent = intentSource.intent
    const calls = intentSource.intent.route.calls

    const { error: calldataError } = this.validateCallData(calls)
    if (calldataError) {
      return { error: calldataError }
    }

    const chainID = Number(intent.route.source)
    const rewardAmount = this.sumTokenAmounts(intent.reward.tokens)
    const routeAmount = this.sumTokenAmounts(intent.route.tokens)
    const netDiff = rewardAmount - routeAmount

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `analyzeIntent`,
        properties: {
          chainID,
          netDiff,
          routeAmount,
          rewardAmount,
        },
      }),
    )

    return {
      response: {
        intentSource,
        isNegative: netDiff < 0n,
        rewardAmount,
        routeAmount,
      },
    }
  }

  rankIntents(
    intents: IntentSourceModel[],
    maxSlippage = 0.2, // 20% loss threshold
  ): IntentRankingResult {
    const ranked: RankedIntent[] = []
    const skipped: { intentSource: IntentSourceModel; reason: string }[] = []

    for (const intentSource of intents) {
      const { response: analysisResult, error } = this.analyzeIntent(intentSource)

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `rankIntents: Failed to analyze intent ${intentSource.intent.hash}`,
            properties: {
              error: error.message || error,
              intentHash: intentSource.intent.hash,
            },
          }),
        )
        skipped.push({ intentSource, reason: error.message })
        continue
      }

      if (!analysisResult!.isNegative) {
        continue
      }

      const { rewardAmount, routeAmount } = analysisResult!

      if (routeAmount === 0n) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Route amount is zero ${intentSource.intent.hash}`,
            properties: {
              intentHash: intentSource.intent.hash,
            },
          }),
        )
        skipped.push({ intentSource, reason: 'Route amount is zero' })
        continue
      }

      const netDiff = rewardAmount - routeAmount
      const slippage = NegativeIntentAnalyzerService.getSlippage(rewardAmount, routeAmount)

      if (slippage > maxSlippage) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `rankIntents: Slippage too high`,
            properties: {
              netDiff,
              slippage,
              maxSlippage,
            },
          }),
        )

        skipped.push({
          intentSource,
          reason: `Slippage too high: ${slippage.toFixed(4)}`,
        })
        continue
      }

      ranked.push({
        intentSource,
        slippage,
        rewardAmount,
        routeAmount,
        netDiff,
      })
    }

    ranked.sort((a, b) => {
      if (a.slippage !== b.slippage) {
        return a.slippage - b.slippage // lower slippage first
      }
      return Number(b.rewardAmount - a.rewardAmount) // higher reward second
    })

    return { ranked, skipped }
  }

  private sumTokenAmounts(tokens: TokenAmountDataModel[]): bigint {
    return tokens.reduce((acc, t) => acc + t.amount, 0n)
  }

  private validateCallData(calls: TargetCallDataModel[]): EcoResponse<void> {
    if (calls.length !== 1) {
      return { error: EcoError.UnexpectedCallCount }
    }

    const data: Hex = calls[0].data

    if (data.length < MinCallDataLength) {
      return { error: EcoError.InvalidCallData }
    }

    if (!this.isTransfer(data)) {
      return { error: EcoError.CallDataIsNotTransfer }
    }

    return {}
  }

  private isTransfer(data: Hex): boolean {
    // Check if the data starts with the ERC20 transfer selector
    return data.startsWith('0xa9059cbb')
  }
}
