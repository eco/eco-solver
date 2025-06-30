import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { FeeService } from '@/fee/fee.service'
import {
  equivalentNativeGas,
  getFunctionCalls,
  getFunctionTargets,
  getNativeFulfill,
  getTransactionTargetData,
  isNativeETH,
  isNativeIntent,
} from '@/intent/utils'
import { TransactionTargetData } from '@/intent/utils-intent.service'
import { ProofService } from '@/prover/proof.service'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { difference } from 'lodash'
import { Hex } from 'viem'
import { isGreaterEqual, normalizeBalance } from '@/fee/utils'
import { CallDataInterface } from '@/contracts'
import { EcoError } from '@/common/errors/eco-error'
import { BalanceService } from '../balance/balance.service'

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
  validTransferLimit: boolean
  validExpirationTime: boolean
  validDestination: boolean
  fulfillOnDifferentChain: boolean
  sufficientBalance: boolean
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
  private isNativeETHSupported = false
  private readonly logger = new Logger(ValidationService.name)
  private minEthBalanceWei: bigint
  constructor(
    private readonly proofService: ProofService,
    private readonly feeService: FeeService,
    private readonly balanceService: BalanceService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  onModuleInit() {
    this.isNativeETHSupported = this.ecoConfigService.getIntentConfigs().isNativeETHSupported
    this.minEthBalanceWei = BigInt(this.ecoConfigService.getEth().simpleAccount.minEthBalanceWei)
  }

  /**
   * Executes all the validations we have on the model and solver
   *
   * @param intent the source intent model
   * @param solver the solver for the source chain
   * @param txValidationFn
   * @returns true if they all pass, false otherwise
   */
  async assertValidations(
    intent: ValidationIntentInterface,
    solver: Solver,
    txValidationFn: TxValidationFn = () => true,
  ): Promise<ValidationChecks> {
    const supportedProver = this.supportedProver({
      prover: intent.reward.prover,
      source: Number(intent.route.source),
      destination: Number(intent.route.destination),
    })
    const supportedNative = this.supportedNative(intent)
    const supportedTargets = this.supportedTargets(intent, solver)
    const supportedTransaction = this.supportedTransaction(intent, solver, txValidationFn)
    const validTransferLimit = await this.validTransferLimit(intent)
    const validExpirationTime = this.validExpirationTime(intent)
    const validDestination = this.validDestination(intent)
    const fulfillOnDifferentChain = this.fulfillOnDifferentChain(intent)
    const sufficientBalance = await this.hasSufficientBalance(intent)

    return {
      supportedNative,
      supportedProver,
      supportedTargets,
      supportedTransaction,
      validTransferLimit,
      validExpirationTime,
      validDestination,
      fulfillOnDifferentChain,
      sufficientBalance,
    }
  }

  /**
   * Checks if a given source chain ID and prover are supported within the available intent sources.
   *
   * @param {Object} opts - The operation parameters.
   * @param {bigint} opts.chainID - The ID of the chain to check for support.
   * @param {Hex} opts.prover - The prover to validate against the intent sources.
   * @return {boolean} Returns true if the source chain ID and prover are supported, otherwise false.
   */
  supportedProver(opts: { source: number; destination: number; prover: Hex }): boolean {
    const isWhitelisted = this.checkProverWhitelisted(opts.source, opts.prover)

    if (!isWhitelisted) return false

    const type = this.proofService.getProverType(Number(opts.source), opts.prover)

    if (!type) {
      return false
    }

    switch (true) {
      case type.isHyperlane():
      case type.isMetalayer():
        return this.checkProverWhitelisted(opts.destination, opts.prover)
      default:
        throw EcoError.ProverNotAllowed(opts.source, opts.destination, opts.prover)
    }
  }

  checkProverWhitelisted(chainID: number, prover: Hex): boolean {
    return this.ecoConfigService
      .getIntentSources()
      .some(
        (intent) =>
          intent.chainID === chainID && intent.provers.some((_prover) => _prover == prover),
      )
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
    if (this.isNativeETHSupported) {
      if (isNativeIntent(intent)) {
        return equivalentNativeGas(intent, this.logger) && isNativeETH(intent)
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
   * @param txValidationFn
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

  /**
   * Checks if the solver has sufficient balance in its wallets to fulfill the transaction
   * @param intent the source intent model
   * @returns true if the solver has sufficient balance
   */
  async hasSufficientBalance(intent: ValidationIntentInterface): Promise<boolean> {
    try {
      const tokens = intent.route.tokens.map((t) => t.token)
      const destinationChain = Number(intent.route.destination)

      // Fetch token balances
      const tokenBalances = await this.balanceService.fetchTokenBalances(destinationChain, tokens)
      const solver = this.ecoConfigService.getSolver(destinationChain)
      if (!solver) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: `hasSufficientBalance: No solver targets found`,
            properties: {
              intentHash: intent.hash,
              destination: destinationChain,
            },
          }),
        )
        return false
      }
      const solverTargets = solver.targets // Ensure the solver is initialized

      // Check if solver has enough token balances
      for (const routeToken of intent.route.tokens) {
        const balance = tokenBalances[routeToken.token]
        const minReqDollar = solverTargets[routeToken.token]?.minBalance || 0
        // Normalize the balance to the token's decimals, configs have the minReq in dollar value
        const balanceMinReq = normalizeBalance(
          { balance: BigInt(minReqDollar), decimal: 0 },
          balance.decimals,
        )

        if (!balance || balance.balance - balanceMinReq.balance < routeToken.amount) {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: `hasSufficientBalance: Insufficient token balance`,
              properties: {
                token: routeToken.token,
                required: routeToken.amount.toString(),
                available: balance?.balance.toString() || '0',
                intentHash: intent.hash,
                destination: destinationChain,
              },
            }),
          )
          return false
        }
      }

      // Check native balance if there are native value calls
      const totalFulfillNativeValue = getNativeFulfill(intent.route.calls)

      if (totalFulfillNativeValue > 0n) {
        const solverNativeBalance = await this.balanceService.getNativeBalance(
          destinationChain,
          'kernel',
        )
        if (solverNativeBalance < totalFulfillNativeValue) {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: `hasSufficientBalance: Insufficient native balance`,
              properties: {
                required: totalFulfillNativeValue.toString(),
                available: solverNativeBalance.toString(),
                intentHash: intent.hash,
                destination: destinationChain,
              },
            }),
          )
          return false
        }
      }

      return true
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `hasSufficientBalance: Error checking balance`,
          properties: {
            error: error.message,
            intentHash: intent.hash,
            destination: intent.route.destination,
          },
        }),
      )
      return false
    }
  }

  /**
   *
   * @param intent the source intent model
   * @returns
   */
  validExpirationTime(intent: ValidationIntentInterface): boolean {
    //convert to milliseconds
    const time = Number(intent.reward.deadline) * 1000
    const expires = new Date(time)
    return this.proofService.isIntentExpirationWithinProofMinimumDate(
      Number(intent.route.source),
      intent.reward.prover,
      expires,
    )
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
   * @returns
   */
  fulfillOnDifferentChain(intent: ValidationIntentInterface): boolean {
    return intent.route.destination !== intent.route.source
  }
}
