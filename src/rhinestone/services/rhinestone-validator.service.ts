import { Injectable, Logger } from '@nestjs/common'
import * as _ from 'lodash'
import { hashIntent, hashRoute } from '@eco-foundation/routes-ts'
import { Address, encodePacked, Hex, isAddressEqual, keccak256 } from 'viem'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { ValidateIntentService } from '@/intent/validate-intent.service'
import { toReward, toRoute } from '@/rhinestone/utils/intent-extractor'
import { decodeRouteFillCall } from '@/rhinestone/utils/decode-router'
import { decodeAdapterClaim, decodeAdapterFill, decodeRouterCall } from '@/rhinestone/utils/decoder'
import { RhinestoneConfigService } from '@/rhinestone/services/rhinestone-config.service'
import { RhinestoneContractsService } from '@/rhinestone/services/rhinestone-contracts.service'
import {
  ChainAction,
  ChainCall,
  RhinestoneRelayerActionV1,
} from '@/rhinestone/types/rhinestone-websocket.types'
import { RhinestoneRouterRouteFn } from '@/rhinestone/types/rhinestone-contracts.types'

/**
 * Service for validating Rhinestone relayer actions and their components.
 * Ensures that fills and claims are valid and properly formatted.
 */
@Injectable()
export class RhinestoneValidatorService {
  private readonly logger = new Logger(RhinestoneValidatorService.name)

  constructor(
    private readonly validateIntentService: ValidateIntentService,
    private readonly rhinestoneConfigService: RhinestoneConfigService,
    private readonly rhinestoneContractsService: RhinestoneContractsService,
  ) {}

  /**
   * Validate a relayer action message including fill and claim validation
   * @param message The relayer action message to validate
   * @returns The validated intent and fill data
   * @throws {EcoError} If validation fails
   */
  async validateRelayerAction(message: RhinestoneRelayerActionV1) {
    const { fill, claims } = message

    if (claims.length !== 1) {
      // TODO: Limit claims to only one while testing
      throw new EcoError('Invalid claims length')
    }

    const [claim] = claims

    const decodedFill = await this.validateFill(fill)
    const { intent, fillData } = await this.validateClaim(claim)

    const { intentHash: claimIntentHash } = hashIntent(intent)
    const fillRouteHash = hashRoute(decodedFill.route)
    const fillIntentHash = keccak256(
      encodePacked(['bytes32', 'bytes32'], [fillRouteHash, decodedFill.rewardHash]),
    )

    if (fillIntentHash !== claimIntentHash) {
      throw new EcoError('Intent hash for fill and claim do not match')
    }

    if (intent.route.source === intent.route.destination) {
      throw new EcoError('Cannot execute same chain intetns')
    }

    if (fillData.order.targetChainId !== intent.route.destination) {
      throw new EcoError('Intent destination does not match order target chainID')
    }

    const isValidIntent = await this.validateIntentService.validateFullIntent(intent, {
      skipIntentFunded: true,
      skipLimitValidation: true,
      skipTransactionValidation: true,
      useRouteTokens: true,
    })
    if (!isValidIntent) {
      throw new EcoError('Intent failed validations')
    }

    return { intent, fillData }
  }

  /**
   * Validate a fill action from a relayer message
   * @param chainAction The chain action containing the fill
   * @returns The decoded fill data
   * @throws {EcoError} If fill validation fails
   */
  private async validateFill(chainAction: ChainAction) {
    const router = chainAction.call.to
    const chainID = chainAction.call.chainId

    const { decodedCall } = this.validateRouterCall(chainAction.call)
    const { adapterCalldata } = this.extractRouteCall(decodedCall, 'routeFill')

    // TODO: We need to update the solverContext to the claimant

    const { type, selector } = decodeRouteFillCall(adapterCalldata)

    if (type !== 'adapterCall') {
      throw new EcoError('Fill is not an adapter call')
    }

    await this.validateAdapterAndArbiter(chainID, router, 'fill', selector)

    const [fillData] = decodeAdapterFill(adapterCalldata)

    return fillData
  }

  /**
   * Validate a claim action from a relayer message
   * @param chainAction The chain action containing the claim
   * @returns The extracted intent and fill data
   * @throws {EcoError} If claim validation fails
   */
  private async validateClaim(chainAction: ChainAction) {
    const isSettlementLayerValid =
      chainAction.settlementLayer === this.rhinestoneConfigService.getOrder().settlementLayer
    if (!isSettlementLayerValid) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid settlement layer`,
          properties: { settlementLayer: chainAction.settlementLayer },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const chainID = chainAction.call.chainId
    const router = chainAction.call.to

    const { decodedCall } = this.validateRouterCall(chainAction.call)
    const { adapterCalldata } = this.extractRouteCall(decodedCall, 'routeClaim')

    const { type, selector } = decodeRouteFillCall(adapterCalldata)

    if (type !== 'adapterCall') {
      throw new EcoError('Claim is not an adapter call')
    }

    const { arbiterAddr } = await this.validateAdapterAndArbiter(chainID, router, 'claim', selector)

    const fillData = decodeAdapterClaim(adapterCalldata)
    const { order, claimHash } = fillData

    const claimHashOracle = await this.rhinestoneContractsService.getClaimHashOracle(
      chainID,
      arbiterAddr,
    )

    const route = toRoute(order, claimHash, chainID, claimHashOracle)
    const reward = toReward(order)

    const intent = { route, reward }

    return { intent, fillData }
  }

  /**
   * Validate that a call is to the correct router with zero value
   * @param call The chain call to validate
   * @returns The decoded router call
   * @throws {EcoError} If router validation fails
   */
  private validateRouterCall(call: ChainCall) {
    const { router } = this.rhinestoneConfigService.getContracts(call.chainId)

    const isValueZero = BigInt(call.value) === 0n

    if (!isAddressEqual(call.to, router)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Invalid router address`,
          properties: { expected: router, received: call.to },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    if (!isValueZero) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Failed to execute router call`,
          properties: { isValueZero },
        }),
      )

      throw EcoError.InvalidRouterCall
    }

    try {
      const decodedCall = decodeRouterCall(call.data)
      return { decodedCall }
    } catch (error) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Rhinestone: Failed to decode router call`,
          properties: { call },
        }),
      )
      throw EcoError.InvalidRouterCall
    }
  }

  /**
   * Validate adapter and arbiter addresses match expected configuration
   * @param chainId The chain ID to validate on
   * @param router The router address
   * @param type Whether validating fill or claim adapter
   * @param selector The function selector
   * @returns The validated adapter and arbiter addresses
   * @throws {EcoError} If addresses don't match configuration
   */
  private async validateAdapterAndArbiter(
    chainId: number,
    router: Address,
    type: 'fill' | 'claim',
    selector: Hex,
  ): Promise<{ adapterAddr: Address; arbiterAddr: Address }> {
    const contracts = this.rhinestoneConfigService.getContracts(chainId)

    const adapterAddr = await this.rhinestoneContractsService.getAdapter(
      chainId,
      router,
      type,
      selector,
    )
    const arbiterAddr = await this.rhinestoneContractsService.getArbiter(chainId, adapterAddr)

    if (!isAddressEqual(contracts.ecoAdapter, adapterAddr)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Invalid eco adapter address`,
          properties: { expected: contracts.ecoAdapter, received: adapterAddr },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    if (!isAddressEqual(contracts.ecoArbiter, arbiterAddr)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Invalid eco arbiter address`,
          properties: { expected: contracts.ecoArbiter, received: arbiterAddr },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    return { adapterAddr, arbiterAddr }
  }

  /**
   * Extract and validate a single route call from decoded router data
   * @param decodedCall The decoded function call data
   * @param functionName The expected function name (routeFill or routeClaim)
   * @returns The solver context and adapter calldata
   * @throws {EcoError} If not exactly one route call is found
   */
  private extractRouteCall(
    decodedCall: { functionName: string; args?: unknown } | RhinestoneRouterRouteFn,
    functionName: 'routeFill' | 'routeClaim',
  ): { solverContext: Address; adapterCalldata: Hex } {
    const isRouteCall = (call: {
      functionName: string
      args?: unknown
    }): call is RhinestoneRouterRouteFn => call.functionName === functionName

    if (!isRouteCall(decodedCall)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Invalid router call`,
          properties: { functionName: decodedCall.functionName },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const routeCalls = _.zipWith(
      decodedCall.args[0] as Address[],
      decodedCall.args[1] as Hex[],
      (solverContext: Address, adapterCalldata: Hex) => ({
        solverContext,
        adapterCalldata,
      }),
    )

    if (routeCalls.length !== 1) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Invalid route call - Only one call allowed`,
          properties: { calls: routeCalls.length },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    return routeCalls[0]
  }
}
