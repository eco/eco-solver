import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { JobsOptions, Queue } from 'bullmq'
import { Hex } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { QUEUES } from '@/common/redis/constants'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getIntentJobId } from '@/common/utils/strings'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { SolanaCostService } from '@/solana/solana-cost.service'
import { JupiterPriceService } from '@/solana/price/jupiter-price.service'
import { SOL_TOKEN_ADDRESS, SolanaFeeService } from '@/fee/solanaFee.service'
import { fetchDecimals } from '@/solana/utils'
import { FeeService } from '@/fee/fee.service'

const MIN_MARGIN_USD: number = 1
export const SOLANA_HYPERLAND_DOMAIN_ID: bigint = 1399811149n

@Injectable()
export class SolanaFeasableIntentService implements OnModuleInit {
  private readonly logger = new Logger(SolanaFeasableIntentService.name)
  private intentJobConfig!: JobsOptions

  constructor(
    @InjectQueue(QUEUES.SOLANA_INTENT.queue) private readonly svmQueue: Queue,

    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoCfg: EcoConfigService,
    private readonly solanaCostService: SolanaCostService,
    private readonly solanaFeeService: SolanaFeeService,
    private readonly feeService: FeeService,
    private readonly price: JupiterPriceService,

    @Inject('SOLVER_SOLANA_PUBKEY') private readonly solverKey: PublicKey,
  ) {}

  onModuleInit() {
    this.intentJobConfig = this.ecoCfg.getRedis().jobs.intentJobConfig
  }

  // Feasible = (rewardUsd − executionUsd) >= minMargin
  async feasableIntent(intentHash: Hex) {
    const intentData = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, err } = intentData ?? {}
    if (!model) {
      if (err) throw err
      return
    }

    const solConfig = this.ecoCfg.getSolanaConfig()
    const connection = new Connection(solConfig.rpc_url, 'confirmed')
    const intent = model.intent

    const simulationResult = await this.solanaCostService.simulateIntent(intent, this.solverKey)
    const executionUsdCost = await this.calculateUsdCost(
      simulationResult.lamportsOut,
      simulationResult.tokenOut,
      connection,
    )

    let rewardUsd = 0
    if (model.intent.route.source === SOLANA_HYPERLAND_DOMAIN_ID) {
      const result = await this.solanaFeeService.calculateRewardUsdFromAny({
        nativeValue: model.intent.reward.nativeValue,
        tokens: model.intent.reward.tokens.map((token) => ({
          token: token.token,
          amount: token.amount.toString(),
        })),
      })

      if ('error' in result) {
        throw result.error
      }

      rewardUsd = result.totalUsd
    } else {
      const { totalRewardsNormalized, error } = await this.feeService.getTotalRewards(model.intent)
      if (error) {
        throw error
      }
      rewardUsd = Number(totalRewardsNormalized) / 10 ** 6 // normalized to USD
    }

    if (rewardUsd === 0) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `SVM-feasibility check: no reward`,
          properties: { intentHash },
        }),
      )
      return
    }

    const profit = rewardUsd - executionUsdCost
    const feasable = profit >= MIN_MARGIN_USD

    const jobId = getIntentJobId('feasable', intentHash, model.intent.logIndex)

    if (feasable) {
      await this.svmQueue.add(QUEUES.SOLANA_INTENT.jobs.fulfill_intent, intentHash, {
        jobId,
        ...this.intentJobConfig,
      })
    } else {
      await this.utilsIntentService.updateInfeasableIntentModel(
        model,
        new Error(`Not profitable (${profit.toFixed(4)} USD)`),
      )
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'SVM-feasibility check',
        properties: {
          intentHash,
          executionUsdCost,
          rewardUsd,
          profit,
          feasable,
        },
      }),
    )
  }

  private async calculateUsdCost(
    lamports: bigint,
    tokenSpend: Record<string, bigint>,
    connection: Connection,
  ) {
    let cost = 0

    cost += await this.lamportsToUsd(lamports)
    cost += await this.tokensToUsd(tokenSpend, connection)

    return cost
  }

  private async lamportsToUsd(lamports: bigint): Promise<number> {
    if (lamports === 0n) {
      return 0
    }
    const solPrice = (await this.price.getPriceUsd(SOL_TOKEN_ADDRESS)) ?? 0

    return (Number(lamports) / LAMPORTS_PER_SOL) * solPrice
  }

  private async tokensToUsd(
    tokens: Record<string, bigint>,
    connection: Connection,
  ): Promise<number> {
    if (!Object.keys(tokens).length) {
      return 0
    }

    const mints = Object.keys(tokens).map((mint) => mint)
    const prices = await this.price.getPricesUsd(mints)
    const decimalsMap = await fetchDecimals(mints, connection)
    let total = 0

    for (const [mint, raw] of Object.entries(tokens)) {
      const decimals = decimalsMap[mint]
      if (!decimals) {
        this.logger.warn(`Couldn't get decimals for mint ${mint}`)
        continue
      }

      const tokenPrice = prices[mint]
      if (!tokenPrice) {
        this.logger.warn(`No price for mint ${mint} found`)
        continue
      }

      const uiAmount = Number(raw) / 10 ** decimals
      total += uiAmount * tokenPrice
    }

    return total
  }
}
