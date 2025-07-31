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

@Injectable()
export class RhinestoneValidatorService {
  private readonly logger = new Logger(RhinestoneValidatorService.name)

  constructor(
    private readonly validateIntentService: ValidateIntentService,
    private readonly rhinestoneConfigService: RhinestoneConfigService,
    private readonly rhinestoneContractsService: RhinestoneContractsService,
  ) {}

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

    const isValidIntent = await this.validateIntentService.validateFullIntent(intent)
    if (!isValidIntent) {
      throw new EcoError('Intent failed validations')
    }

    return { intent, fillData }
  }

  private async validateFill(chainAction: ChainAction) {
    const router = chainAction.call.to
    const chainID = chainAction.call.chainId

    const { decodedCall } = this.validateRouterCall(chainAction.call)

    if (decodedCall.functionName !== 'routeFill') {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill: Invalid router call`,
          properties: { functionName: decodedCall.functionName },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const routeFillCalls = _.zipWith(
      decodedCall.args[0],
      decodedCall.args[1],
      (solverContext: Address, adapterCalldata: Hex) => ({
        solverContext,
        adapterCalldata,
      }),
    )

    if (routeFillCalls.length !== 1) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill: Invalid route call - Only one call allowed`,
          properties: { calls: routeFillCalls.length },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    // TODO: We need to update the solverContext to the claimant

    const { adapterCalldata } = routeFillCalls[0]

    const { type, selector } = decodeRouteFillCall(adapterCalldata)

    if (type !== 'adapterCall') {
      throw new EcoError('Claim is not an adapter call')
    }

    const contracts = this.rhinestoneConfigService.getContracts(chainAction.call.chainId)

    const adapterAddr = await this.rhinestoneContractsService.getAdapter(
      chainID,
      router,
      'fill',
      selector,
    )
    const arbiterAddr = await this.rhinestoneContractsService.getArbiter(chainID, adapterAddr)

    if (!isAddressEqual(contracts.ecoAdapter, adapterAddr)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid eco adapter address`,
          properties: { expected: contracts.ecoAdapter, received: adapterAddr },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    if (!isAddressEqual(contracts.ecoArbiter, arbiterAddr)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid eco arbiter address`,
          properties: { expected: contracts.ecoArbiter, received: arbiterAddr },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const [fillData] = decodeAdapterFill(adapterCalldata)

    return fillData
  }

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

    const contracts = this.rhinestoneConfigService.getContracts(chainAction.call.chainId)

    const chainID = chainAction.call.chainId
    const router = chainAction.call.to

    const { decodedCall } = this.validateRouterCall(chainAction.call)

    if (decodedCall.functionName !== 'routeClaim') {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid router call`,
          properties: { functionName: decodedCall.functionName },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const routeClaimCalls = _.zipWith(
      decodedCall.args[0],
      decodedCall.args[1],
      (solverContext: Address, adapterCalldata: Hex) => ({
        solverContext,
        adapterCalldata,
      }),
    )

    if (routeClaimCalls.length !== 1) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid route call - Only one call allowed`,
          properties: { calls: routeClaimCalls.length },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const { adapterCalldata } = routeClaimCalls[0]

    const { type, selector } = decodeRouteFillCall(adapterCalldata)

    if (type !== 'adapterCall') {
      throw new EcoError('Claim is not an adapter call')
    }

    const adapterAddr = await this.rhinestoneContractsService.getAdapter(
      chainID,
      router,
      'claim',
      selector,
    )
    const arbiterAddr = await this.rhinestoneContractsService.getArbiter(chainID, adapterAddr)

    if (!isAddressEqual(contracts.ecoAdapter, adapterAddr)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid eco adapter address`,
          properties: { expected: contracts.ecoAdapter, received: adapterAddr },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    if (!isAddressEqual(contracts.ecoArbiter, arbiterAddr)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid eco arbiter address`,
          properties: { expected: contracts.ecoArbiter, received: arbiterAddr },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

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

  private validateRouterCall(call: ChainCall) {
    const { router } = this.rhinestoneConfigService.getContracts(call.chainId)

    const isValueZero = BigInt(call.value) === 0n

    if (!isAddressEqual(call.to, router)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill: Invalid router address`,
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
}
