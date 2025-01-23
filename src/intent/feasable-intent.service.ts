import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { JobsOptions, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { QUEUES } from '../common/redis/constants'
import { TransactionTargetData, UtilsIntentService } from './utils-intent.service'
import { BalanceService } from '../balance/balance.service'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { EcoError } from '../common/errors/eco-error'
import { Network } from 'alchemy-sdk'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { getIntentJobId } from '../common/utils/strings'
import { Solver } from '../eco-configs/eco-config.types'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Hex } from 'viem'
import { getERC20Selector, TargetCallViemType, TokenAmountViemType } from '../contracts'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class FeasableIntentService implements OnModuleInit {
  private logger = new Logger(FeasableIntentService.name)
  private intentJobConfig: JobsOptions
  private FEE_BASE = 1000n
  private fee: bigint
  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly balanceService: BalanceService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
    //todo get this from config or service per token/chain
    this.fee = 1000n
  }

  /**
   * Validates that the execution of the intent is feasible. This means that the solver can execute
   * the transaction and that transaction cost is profitable to the solver.
   * @param intentHash the intent hash to fetch the intent data from the db with
   * @returns
   */
  async feasableIntent(intentHash: Hex) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `FeasableIntent intent ${intentHash}`,
      }),
    )
    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}
    if (!model || !solver) {
      if (err) {
        throw err
      }
      return
    }

    //check if we have tokens on the solver chain
    const { feasable, results } = await this.validateExecution(model, solver)
    const jobId = getIntentJobId('feasable', intentHash, model!.intent.logIndex)
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `FeasableIntent intent ${intentHash}`,
        properties: {
          feasable,
          jobId,
        },
      }),
    )
    if (feasable) {
      //add to processing queue
      await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.fulfill_intent, intentHash, {
        jobId,
        ...this.intentJobConfig,
      })
    } else {
      await this.utilsIntentService.updateInfeasableIntentModel(model, results)
    }
  }

  /**
   * Validates that each target-data pair is feasible for execution.
   *
   * @param model the create intent model
   * @param solver the target solver
   * @returns
   */
  async validateExecution(
    model: IntentSourceModel,
    solver: Solver,
  ): Promise<{
    feasable: boolean
    results: (
      | false
      | {
          solvent: boolean
          profitable: boolean
        }
      | undefined
    )[]
  }> {
    const execs = model.intent.route.calls.map((call) => {
      return this.validateEachExecution(model, solver, call)
    })
    const results = await Promise.all(execs)
    const feasable =
      results.every((e) => e !== false && e !== undefined && e.solvent && e.profitable) &&
      results.length > 0
    return { feasable, results }
  }

  /**
   * Validates that each target-data pair is feasible for execution. This means that
   * the solver can execute the transaction and that transaction is profitable to the solver.
   *
   * @param model  the create intent model
   * @param solver the target solver
   * @param target the target address of the call
   * @param data the data to send to the target
   * @returns
   */
  async validateEachExecution(
    model: IntentSourceModel,
    solver: Solver,
    call: TargetCallViemType,
  ): Promise<
    | false
    | {
        solvent: boolean
        profitable: boolean
      }
    | undefined
  > {
    const tt = this.utilsIntentService.getTransactionTargetData(model, solver, call)
    if (tt === null) {
      this.logger.error(
        EcoLogMessage.withError({
          message: `feasableIntent: Invalid transaction data`,
          error: EcoError.FeasableIntentNoTransactionError,
          properties: {
            model: model,
          },
        }),
      )
      return false
    }

    switch (tt.targetConfig.contractType) {
      case 'erc20':
        return await this.handleErc20(tt, model, solver, call.target)
      case 'erc721':
      case 'erc1155':
      default:
        return false
    }
  }

  /**
   * Checks if the transaction is feasible for an erc20 token transfer.
   *
   * @param tt the transaction target data
   * @param model the source intent model
   * @param solver the target solver
   * @param target  the target address
   * @returns
   */
  async handleErc20(
    tt: TransactionTargetData,
    model: IntentSourceModel,
    solver: Solver,
    target: Hex,
  ): Promise<{ solvent: boolean; profitable: boolean } | undefined> {
    const targetNetwork = solver.network
    const amount = tt.decodedFunctionData.args ? (tt.decodedFunctionData.args[1] as bigint) : 0n
    switch (tt.selector) {
      case getERC20Selector('transfer'):
        //check we have enough tokens to transfer on destination fullfillment
        const balance = await this.balanceService.getTokenBalance(solver.chainID, target)
        const solvent = balance.balance >= amount
        //return here if we dont have enough tokens to fulfill the transfer
        if (!solvent) {
          return { solvent, profitable: false }
        }

        const sourceNetwork = model.event.sourceNetwork
        const source = this.ecoConfigService
          .getIntentSources()
          .find((intent) => intent.network == sourceNetwork)
        if (!source) {
          return
        }
        //check that we make money on the transfer
        const fullfillAmountUSDC = this.convertToUSDC(targetNetwork, { token: target, amount })
        const profitable = this.isProfitableErc20Transfer(
          sourceNetwork,
          source.tokens,
          model.intent.reward.tokens,
          fullfillAmountUSDC,
        )
        return { solvent, profitable }
      default:
        return
    }
  }

  /**
   * Calculates if a transfer is profitable based on the reward tokens and amounts. It converts the reward tokens to a common currency, then applies
   * the fee to the sum of the reward tokens and amounts. If the sum is greater than the fullfill amount, then the transfer is profitable
   *
   * @param network the network to check profitability on
   * @param acceptedTokens  the tokens that we accepte on the source
   * @param rewardTokens  the tokens that are rewarded by the intent
   * @param rewardAmounts  the amounts of the reward tokens
   * @param fullfillAmountUSDC  the amount of the token to transfer on the destination chain
   * @returns
   */
  isProfitableErc20Transfer(
    network: Network,
    acceptedTokens: readonly Hex[],
    rewardTokens: TokenAmountViemType[],
    fullfillAmountUSDC: bigint,
  ): boolean {
    let sum = 0n
    const unionTokens = rewardTokens.filter((t) => acceptedTokens.includes(t.token))
    unionTokens.forEach((token) => {
      sum += this.convertToUSDC(network, token)
    })

    //check if input tokens are acceptable and greater than + fees
    return sum >= (fullfillAmountUSDC * this.fee) / this.FEE_BASE
  }

  /**
   * Converts a token amount to USDC for that network, we do this in order to have a baseline
   * to compare the profitability of the transaction
   *
   * TODO: right now it just returns a 1-1 conversion, we need to get the price of the token in usdc
   *
   * @param network the network to convert the token to usdc
   * @param token   the token to convert to usdc
   * @returns
   */
  convertToUSDC(network: Network, token: TokenAmountViemType): bigint {
    //todo: get the price of the token in usdc instead of assuming 1-1 here
    return token.amount
  }
}
