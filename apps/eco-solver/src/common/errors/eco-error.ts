import { Network } from '@eco-solver/common/alchemy/network'
import { Logger } from '@nestjs/common'
import * as _ from 'lodash'
import { EcoLogMessage } from '../logging/eco-log-message'
import { Chain, TransactionReceipt } from 'viem'
import { AwsCredential } from '@libs/eco-solver-config'
import { ProofType } from '@eco-solver/contracts'

export class EcoError extends Error {
  // Alchemy Service
  static AlchemyUnsupportedNetworkError(network: Network) {
    return new EcoError(`App does not support network ${network}, check your config file`)
  }
  static AlchemyUnsupportedNetworkIDError(id: number) {
    return new EcoError(`App does not support network ${id}, check your config file`)
  }

  static AlchemyServiceProviderError(network: string) {
    return new EcoError(`Could not create alchemy provider ${network}`)
  }

  static BalanceServiceInvalidDecimals(address: string) {
    return new EcoError(`Token has to be decimals 6, verify conversions before allowing ${address}`)
  }

  static IntentSourceDataNotFound(intentHash: string) {
    return new EcoError(`Could not find data for intent hash ${intentHash}`)
  }

  static IntentValidationFailed(hash: string) {
    return new EcoError(`Intent validation failed for intent hash ${hash}`)
  }

  static IntentSourceNotFound(chainID: number) {
    return new EcoError(`Could not find an intent source for chain ${chainID}`)
  }

  static IntentSourceDataInvalidParams = new Error(
    'IntentSource calls or tokens must have non-zero length',
  )

  static IntentSourceTargetConfigNotFound(target: string) {
    return new EcoError(`Solver does not have target: ${target}`)
  }

  static TargetSelectorNotSupported(target: string) {
    return new EcoError(`Solver does not have target: ${target}`)
  }

  static IntentSourceUnsupportedTargetType(targetType: string) {
    return new EcoError(`Unsupported target type ${targetType}`)
  }

  static ChainConfigNotFound(chainID: string) {
    return new EcoError(`Chain config not found for chain ${chainID}`)
  }

  static ChainRPCNotFound(chainID: number) {
    return new EcoError(`Chain rpc not found for chain ${chainID}`)
  }

  static InvalidSimpleAccountConfig() {
    return new EcoError(`The simple account config is invalid`)
  }

  static InvalidKernelAccountConfig() {
    return new EcoError(`The kernel account config is invalid`)
  }

  static ProverNotSupported(pt: ProofType) {
    return new Error(`The prover type ${pt} is not supported`)
  }

  static ProverNotAllowed(source: number, destination: number, prover: string) {
    return new Error(`The prover ${prover} is not supported on route ${source} to ${destination}`)
  }

  static RebalancingRouteNotFound() {
    return new EcoError(`A rebalancing route not found`)
  }

  static IntentNotFound = new Error('Intent not found')
  static QuoteNotFound = new Error('Quote not found')
  static QuoteDBUpdateError = new Error('Quote not found')
  static GaslessIntentsNotSupported = new Error('Gasless intents are not supported')
  static NoPermitsProvided = new Error('At least one permit must be provided')
  static AllPermitsMustBeOnSameChain = new Error(
    `All Permits must be on the same chain for batching`,
  )

  // Permit Validations
  static InvalidVaultAddress = new EcoError('Permit spender does not match expected vault address')
  static InvalidPermit2Address = new EcoError('Permit2 contract is not whitelisted')
  static InvalidPermitSignature = new EcoError('Invalid permit signature for owner')
  static InvalidPermitNonce = new EcoError('Nonce mismatch for token')
  static PermitExpired = new EcoError('Permit expired for token')
  static PermitExpirationMismatch = new EcoError(
    'On-chain expiration is earlier than signed expiration',
  )
  static PermitSimulationsFailed = new EcoError(`One or more permit simulations failed`)
  static VaultAlreadyClaimed = new EcoError(`Vault for intent has already been claimed`)
  static VaultAlreadyFunded = new EcoError(`Vault for intent is already fully funded`)
  static VaultNotFullyFundedAfterPermit = new EcoError('Vault not fully funded after permit')

  static GasEstimationError = new Error('Error estimating gas')

  static FeasibilityIntentNoTransactionError = new Error('No transaction data found')
  static FulfillIntentNoTransactionError = new Error('No transaction data found')
  static FulfillIntentProverNotFound = new Error('Storage prover not found')
  static FulfillIntentBatchError = new Error('Could not fulfill batch transaction')
  static FulfillIntentRevertError(receipt: TransactionReceipt) {
    const msg = JSON.stringify(receipt, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    return new Error(msg)
  }

  // ValidateIntent Service
  static ValidateIntentDescructureFailed(err?: Error) {
    return err || new Error('Desctructuring the intent from the intent hash failed')
  }

  // WatchIntent Service
  static WatchEventUnsubscribeError = new Error('Could not unsubscribe from watch event')
  static WatchEventUnsubscribeFromError(chainID: number) {
    return new Error(`Could not unsubscribe from watch event for chain : ${chainID}`)
  }
  static WatchEventNoUnsubscribeError(chainID: number) {
    return new Error(`There is no unwatch for chain : ${chainID}`)
  }

  // Viem

  static UnsupportedChainError(chain: Chain) {
    return new EcoError(
      `App does not support chain ${chain.id}:${chain.name}, check your config file`,
    )
  }

  static KmsCredentialsError(config?: AwsCredential) {
    return new EcoError(`Could not get AWS KMS credentials: ${config}`)
  }

  // Crowd Liquidity

  static CrowdLiquidityRewardNotEnough(intentHash: string) {
    return new EcoError(`Intent rewards are not enough: ${intentHash}`)
  }

  static CrowdLiquidityPoolNotSolvent(intentHash: string) {
    return new EcoError(`CrowdLiquidity pool is not solvent for intent: ${intentHash}`)
  }

  // Solver Registration
  static SolverRegistrationError = new EcoError()

  // Signature Validations
  static TypedDataVerificationFailed = new EcoError()
  static SignatureExpired = new EcoError()
  static InvalidSignature = new EcoError()

  // Quote Service
  static NegativeGasOverhead(gasOverhead: number) {
    return new EcoError(`Gas overhead is negative: ${gasOverhead}`)
  }

  static DefaultGasOverheadUndefined() {
    return new EcoError(`Default gas overhead is undefined`)
  }

  // EcoConfig Service

  static isEcoError(error: any): boolean {
    return error instanceof EcoError
  }

  static getErrorObject(error: any): Error {
    if (error instanceof Error) {
      return error
    }

    return new Error(this.getErrorMessage(error))
  }

  static logErrorWithStack(error: any, caller: string, srcLogger: Logger, properties: object = {}) {
    return this._logError(this.getErrorObject(error), caller, srcLogger, properties, true)
  }

  static _logError(
    error: Error,
    caller: string,
    srcLogger: Logger,
    properties: object,
    logStack?: boolean,
  ) {
    srcLogger.error(
      EcoLogMessage.fromDefault({
        message: `${caller}: error`,
        properties: {
          error: error.message,
          ...properties,
        },
      }),

      logStack && error.stack,
    )
  }

  static getErrorMessage(error: any): string {
    if (_.isString(error)) {
      return error
    }

    if (EcoError.isEcoError(error)) {
      return error.toString()
    }

    return (
      error.body ||
      error.error?.reason ||
      error.reason ||
      error.message ||
      error.enumKey ||
      'Unexpected error occurred'
    )
  }
}
