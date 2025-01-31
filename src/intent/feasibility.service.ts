import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Hex } from 'viem'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { ValidationIntentInterface } from '@/intent/validation.sevice'
import { BalanceService } from '@/balance/balance.service'
import { TransactionTargetData, UtilsIntentService } from '@/intent/utils-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Solver } from '@/eco-configs/eco-config.types'
import { CallDataInterface, getERC20Selector, RewardTokensInterface } from '@/contracts'
import { EcoError } from '@/common/errors/eco-error'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class FeasibilityService implements OnModuleInit {
  private logger = new Logger(FeasibilityService.name)
  private FEE_BASE = 1000n
  private fee: bigint
  constructor(
    private readonly balanceService: BalanceService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onModuleInit() {
    //todo get this from config or service per token/chain
    this.fee = 1000n
  }

  async feasableQuote(quoteIntent: QuoteIntentModel) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `feasableQuote intent ${quoteIntent._id}`,
      }),
    )
  }

  /**
   * Validates that each target-data pair is feasible for execution.
   *
   * @param model the create intent model
   * @param solver the target solver
   * @returns
   */
  async validateExecution(
    model: ValidationIntentInterface,
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
    if (model.route.calls.length != 1) {
      return { feasable: false, results: { cause: 'route.calls.length != 1' } as any }
    }
    const execs = model.route.calls.map((call) => {
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
    model: ValidationIntentInterface,
    solver: Solver,
    call: CallDataInterface,
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
          message: `feasibility: Invalid transaction data`,
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
    model: ValidationIntentInterface,
    solver: Solver,
    target: Hex,
  ): Promise<{ solvent: boolean; profitable: boolean } | undefined> {
    switch (tt.selector) {
      case getERC20Selector('transfer'):
        const amount = tt.decodedFunctionData.args ? (tt.decodedFunctionData.args[1] as bigint) : 0n
        //check we have enough tokens to transfer on destination fullfillment
        const balance = await this.balanceService.getTokenBalance(solver.chainID, target)
        const solvent = balance.balance >= amount
        //return here if we dont have enough tokens to fulfill the transfer
        if (!solvent) {
          return { solvent, profitable: false }
        }

        const sourceChainID = model.route.source
        const source = this.ecoConfigService
          .getIntentSources()
          .find((intent) => BigInt(intent.chainID) == sourceChainID)
        if (!source) {
          return
        }
        //check that we make money on the transfer
        const token = this.normalizeToken(BigInt(solver.chainID), {
          token: target,
          amount,
        })
        const profitable = this.isProfitableErc20Transfer(
          sourceChainID,
          source.tokens,
          [...model.reward.tokens],
          token.amount,
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
   * @param chainID the network to check profitability on
   * @param acceptedTokens  the tokens that we accepte on the source
   * @param rewardTokens  the tokens that are rewarded by the intent
   * @param rewardAmounts  the amounts of the reward tokens
   * @param fullfillAmountUSDC  the amount of the token to transfer on the destination chain
   * @returns
   */
  isProfitableErc20Transfer(
    chainID: bigint,
    acceptedTokens: readonly Hex[],
    rewardTokens: RewardTokensInterface[],
    fullfillAmountUSDC: bigint,
  ): boolean {
    let sum = 0n
    const unionTokens = rewardTokens.filter((t) => acceptedTokens.includes(t.token))
    unionTokens.forEach((token) => {
      sum += this.normalizeToken(chainID, token).amount
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
   * @param chainID the chain to convert the token to usdc
   * @param token   the token to convert to usdc
   * @returns
   */
  normalizeToken(chainID: bigint, token: RewardTokensInterface): RewardTokensInterface {
    //todo: get the price of the token in usdc instead of assuming 1-1 here
    return token
  }

  deNormalizeToken(chainID: bigint, token: RewardTokensInterface): RewardTokensInterface {
    //todo: get the price of the token in usdc instead of assuming 1-1 here
    return token
  }
}
