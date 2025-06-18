import { BalanceService } from '@/balance/balance.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { FeeService } from '@/fee/fee.service'
import {
  equivalentNativeGas,
  getFunctionCalls,
  getFunctionTargets,
  getTransactionTargetData,
  isNativeIntent,
} from '@/intent/utils'
import { TransactionTargetData } from '@/intent/utils-intent.service'
import { ProofService } from '@/prover/proof.service'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { difference } from 'lodash'
import { Hex } from 'viem'
import { CallDataInterface } from '../contracts'
import { isGreaterEqual, normalizeBalance } from '../fee/utils'

interface IntentModelWithHashInterface {
  hash?: Hex
}

/**
 * Validation type that mixes the QuoteIntentDataDTO with the hash. This is used to
 * merge quotes and intents validations
 */
export interface ValidationIntentInterface
  extends QuoteIntentDataInterface,
    IntentModelWithHashInterface {}

/**
 * Type that holds all the possible validations that can fail
 */
export type ValidationChecks = {
  supportedProver: boolean
  supportedNative: boolean
  supportedTargets: boolean
  supportedTransaction: boolean
  validSourceMax: boolean
  validTransferLimit: boolean
  validExpirationTime: boolean
  validDestination: boolean
  fulfillOnDifferentChain: boolean
}

/**
 * Validates that all of the validations succeeded
 * @param validations  the validations to check
 * @returns true if all of the validations passed
 */
export function validationsSucceeded(validations: ValidationType): boolean {
  return Object.values(validations).every((v) => v)
}

/**
 * Checks that at least one of the validations failed
 * @param validations the validations to check
 * @returns true if any of the validations failed
 */
export function validationsFailed(validations: ValidationType): boolean {
  return !validationsSucceeded(validations)
}

/**
 * Type that holds all the possible validations that can fail
 */
export type ValidationType = {
  [key in keyof ValidationChecks]: boolean
}

export type TxValidationFn = (tx: TransactionTargetData) => boolean

@Injectable()
export class ValidationService implements OnModuleInit {
  private isNativeEnabled = false
  private readonly logger = new Logger(ValidationService.name)

  constructor(
    private readonly proofService: ProofService,
    private readonly feeService: FeeService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  onModuleInit() {
    this.isNativeEnabled = this.ecoConfigService.getIntentConfigs().isNativeSupported
  }
  /**
   * Executes all the validations we have on the model and solver
   *
   * @param intent the source intent model
   * @param solver the solver for the source chain
   * @returns true if they all pass, false otherwise
   */
  async assertValidations(
    intent: ValidationIntentInterface,
    solver: Solver,
    txValidationFn: TxValidationFn = () => true,
  ): Promise<ValidationChecks> {
    const supportedProver = this.supportedProver({
      sourceChainID: intent.route.source,
      prover: intent.reward.prover,
    })
    const supportedNative = this.supportedNative(intent)
    const supportedTargets = this.supportedTargets(intent, solver)
    const supportedTransaction = this.supportedTransaction(intent, solver, txValidationFn)
    const validTransferLimit = await this.validTransferLimit(intent)
    const validSourceMax = await this.validSourceMax(intent)
    const validExpirationTime = this.validExpirationTime(intent)
    const validDestination = this.validDestination(intent)
    const fulfillOnDifferentChain = this.fulfillOnDifferentChain(intent)

    return {
      supportedNative,
      supportedProver,
      supportedTargets,
      supportedTransaction,
      validSourceMax,
      validTransferLimit,
      validExpirationTime,
      validDestination,
      fulfillOnDifferentChain,
    }
  }

  /**
   * Checks if the IntentCreated event is using a supported prover. It first finds the source intent contract that is on the
   * source chain of the event. Then it checks if the prover is supported by the source intent. In the
   * case that there are multiple matching source intent contracts on the same chain, as long as any of
   * them support the prover, the function will return true.
   *
   * @param ops the intent info
   * @returns
   */
  supportedProver(ops: { sourceChainID: bigint; prover: Hex }): boolean {
    const srcSolvers = this.ecoConfigService.getIntentSources().filter((intent) => {
      return BigInt(intent.chainID) == ops.sourceChainID
    })

    return srcSolvers.some((intent) => {
      return intent.provers.some((prover) => prover == ops.prover)
    })
  }

  /**
   * Verifies that the intent is a supported native.
   *
   * If native intents are enabled, it checks that the native token is the same on both chains
   * If native intents are disabled, it checks that the intent is not a native intent and has no native value components
   *
   * @param intent the intent model
   * @returns
   */
  supportedNative(intent: ValidationIntentInterface): boolean {
    if (this.isNativeEnabled) {
      if (isNativeIntent(intent)) {
        return equivalentNativeGas(intent, this.logger)
      }
      return true
    } else {
      return !isNativeIntent(intent)
    }
  }

  /**
   * Verifies that all the intent targets are supported by the solver. The targets must
   * have data in the transaction in order to be checked. Non-data targets are expected to be
   * pure gas token transfers
   *
   * @param intent the intent model
   * @param solver the solver for the intent
   * @returns
   */
  supportedTargets(intent: ValidationIntentInterface, solver: Solver): boolean {
    const intentFunctionTargets = getFunctionTargets(intent.route.calls as CallDataInterface[])
    const solverTargets = Object.keys(solver.targets)
    //all targets are included in the solver targets array
    const targetsSupported = difference(intentFunctionTargets, solverTargets).length == 0

    if (!targetsSupported) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Targets not supported for intent ${intent.hash ? intent.hash : 'quote'}`,
          properties: {
            ...(intent.hash && {
              intentHash: intent.hash,
              source: intent.route.source,
            }),
          },
        }),
      )
    }
    return targetsSupported
  }

  /**
   * Verifies that the intent calls that are function calls are supported by the solver.
   *
   * @param intent the intent model
   * @param solver the solver for the intent
   * @returns
   */
  supportedTransaction(
    intent: ValidationIntentInterface,
    solver: Solver,
    txValidationFn: TxValidationFn = () => true,
  ): boolean {
    if (intent.route.calls.length == 0) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `supportedSelectors: Target/data invalid`,
        }),
      )
      return false
    }
    const functionCalls = getFunctionCalls(intent.route.calls as CallDataInterface[])
    return functionCalls.every((call) => {
      const tx = getTransactionTargetData(solver, call)
      return tx && txValidationFn(tx)
    })
  }
  /**
   * Checks if the transfer total is within the bounds of the solver, ie below a certain threshold
   * @param intent the source intent model
   * @returns  true if the transfer is within the bounds
   */
  async validTransferLimit(intent: ValidationIntentInterface): Promise<boolean> {
    const { totalFillNormalized, error } = await this.feeService.getTotalFill(intent)
    if (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `validTransferLimit: Error getting total fill`,
          properties: {
            error: error.message,
            intentHash: intent.hash,
            source: intent.route.source,
          },
        }),
      )
      return false
    }

    const { tokenBase6, nativeBase18 } = this.feeService.getFeeConfig({ intent }).limit

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `validTransferLimit: Total fill normalized`,
        properties: {
          tokenTotalFillNormalized: totalFillNormalized.token.toString(),
          nativeTotalFillNormalized: totalFillNormalized.native.toString(),
          tokenBase6: tokenBase6.toString(),
          nativeBase18: nativeBase18.toString(),
        },
      }),
    )

    // convert to a normalized total to use utils compare function
    return isGreaterEqual({ token: tokenBase6, native: nativeBase18 }, totalFillNormalized)
  }

  async validSourceMax(intent: ValidationIntentInterface): Promise<boolean> {
    try {
      // Get solver for the source chain
      const solver = this.ecoConfigService.getSolver(intent.route.source)
      if (!solver) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `validSourceMax: No solver found for source chain ${intent.route.source}`,
            properties: {
              sourceChain: intent.route.source,
              intentHash: intent.hash,
            },
          }),
        )
        return false
      }

      // Check each reward token against maxBalance
      const tokensWithinBound = await this.validSourceTokenMax(intent, solver)
      const nativeWithinBound = await this.validSourceNativeMax(intent, solver)
      return tokensWithinBound && nativeWithinBound
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `validSourceMax: Error validating max balance`,
          properties: {
            error: error.message,
            intentHash: intent.hash,
            source: intent.route.source,
          },
        }),
      )
      return false
    }
  }

  async validSourceTokenMax(intent: ValidationIntentInterface, solver: Solver): Promise<boolean> {
    for (const rewardToken of intent.reward.tokens) {
      const targetConfig = solver.targets[rewardToken.token as string]
      if (!targetConfig || !targetConfig.maxBalance) {
        // If no maxBalance is configured, skip this validation
        continue
      }

      // Get current balance for this reward token
      const tokenBalance = await this.balanceService.fetchTokenBalance(
        Number(intent.route.source),
        rewardToken.token as Hex,
      )
      const currentBalance = tokenBalance.balance

      // Calculate projected balance after receiving the reward amount
      // On source chain, solver receives reward tokens from user
      const projectedBalance = currentBalance + rewardToken.amount

      // Normalize maxBalance (stored as dollar units(decimal = 0), convert to token units)
      const normalizedMaxBalance = normalizeBalance(
        { balance: BigInt(targetConfig.maxBalance), decimal: 0 },
        tokenBalance.decimals,
      ).balance

      // Check if projected balance would exceed maxBalance
      if (projectedBalance > normalizedMaxBalance) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `validSourceMax: Reward would exceed maxBalance`,
            properties: {
              rewardToken: rewardToken.token,
              currentBalance: currentBalance.toString(),
              rewardAmount: rewardToken.amount.toString(),
              projectedBalance: projectedBalance.toString(),
              maxBalance: normalizedMaxBalance.toString(),
              intentHash: intent.hash,
            },
          }),
        )
        return false
      }
    }
    return true
  }

  async validSourceNativeMax(intent: ValidationIntentInterface, solver: Solver): Promise<boolean> {
    if (!isNativeIntent(intent)) {
      return true // If not a native intent, no need to check max balance
    }

    try {
      // Get current native balance for the solver's wallet
      const client = await this.kernelAccountClientService.getClient(Number(intent.route.source))
      const walletAddress = client.kernelAccount.address
      const currentNativeBalance = await client.getBalance({ address: walletAddress })

      // Calculate total native amount from the intent
      // On source chain, solver receives native value from reward and route calls
      let totalNativeAmount = intent.reward.nativeValue || 0n

      // Add native value from route calls
      for (const call of intent.route.calls) {
        if (call.value > 0) {
          totalNativeAmount += call.value
        }
      }

      // Calculate projected balance after receiving the native amounts
      const projectedBalance = currentNativeBalance + totalNativeAmount

      // Check if projected balance would exceed nativeMax
      if (projectedBalance > solver.nativeMax) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `validSourceNativeMax: Native reward would exceed nativeMax`,
            properties: {
              currentBalance: currentNativeBalance.toString(),
              rewardNativeValue: (intent.reward.nativeValue || 0n).toString(),
              totalNativeAmount: totalNativeAmount.toString(),
              projectedBalance: projectedBalance.toString(),
              nativeMax: solver.nativeMax.toString(),
              intentHash: intent.hash,
              sourceChain: intent.route.source,
            },
          }),
        )
        return false
      }

      return true
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `validSourceNativeMax: Error validating native max balance`,
          properties: {
            error: error.message,
            intentHash: intent.hash,
            source: intent.route.source,
          },
        }),
      )
      return false
    }
  }

  /**
   *
   * @param intent the source intent model
   * @param solver the solver for the source chain
   * @returns
   */
  validExpirationTime(intent: ValidationIntentInterface): boolean {
    //convert to milliseconds
    const time = Number.parseInt(`${intent.reward.deadline as bigint}`) * 1000
    const expires = new Date(time)
    return this.proofService.isIntentExpirationWithinProofMinimumDate(intent.reward.prover, expires)
  }

  /**
   * Checks that the intent destination is supported by the solver
   * @param intent the source intent model
   * @returns
   */
  validDestination(intent: ValidationIntentInterface): boolean {
    return this.ecoConfigService.getSupportedChains().includes(intent.route.destination)
  }

  /**
   * Checks that the intent fulfillment is on a different chain than its source
   * Needed since some proving methods(Hyperlane) cant prove same chain
   * @param intent the source intent
   * @param solver the solver used to fulfill
   * @returns
   */
  fulfillOnDifferentChain(intent: ValidationIntentInterface): boolean {
    return intent.route.destination !== intent.route.source
  }
}
