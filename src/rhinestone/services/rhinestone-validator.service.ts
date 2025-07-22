import { Injectable, Logger } from '@nestjs/common'
import * as _ from 'lodash'
import { Address, Hex, isAddressEqual } from 'viem'
import {
  ChainAction,
  ChainCall,
  RhinestoneRelayerActionV1,
} from '../types/rhinestone-websocket.types'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { decodeClaim, decodeFill, decodeRouterCall } from '@/rhinestone/utils/decoder'
import { RhinestoneConfigService } from '@/rhinestone/services/rhinestone-config.service'
import { extractIntent } from '@/rhinestone/utils/intent-extractor'

@Injectable()
export class RhinestoneValidatorService {
  private readonly logger = new Logger(RhinestoneValidatorService.name)

  constructor(private readonly rhinestoneConfigService: RhinestoneConfigService) {}

  validateRelayerAction(message: RhinestoneRelayerActionV1) {
    const { fill, claims } = message

    if (claims.length !== 1) {
      // TODO: Limit claims to only one while testing
      throw new EcoError('Invalid claims length')
    }

    const [claim] = claims

    this.validateFill(fill)
    this.validateClaim(claim)
  }

  private validateFill(chainAction: ChainAction) {
    const isSettlementLayerValid =
      chainAction.settlementLayer === this.rhinestoneConfigService.getOrder().settlementLayer
    if (!isSettlementLayerValid) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill: Invalid settlement layer`,
          properties: { settlementLayer: chainAction.settlementLayer },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const { decodedCall } = this.validateRouterCall(chainAction.call)

    if (decodedCall.functionName !== 'routeClaim') {
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
      (target: Address, data: Hex) => ({
        target,
        data,
      }),
    )

    if (routeFillCalls.length === 1) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill: Invalid route call - Only one call allowed`,
          properties: { calls: routeFillCalls.length },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const contracts = this.rhinestoneConfigService.getContracts(chainAction.call.chainId)

    const { target: ecoAdapterAddr, data: adapterData } = routeFillCalls[0]

    if (isAddressEqual(contracts.ecoAdapter, ecoAdapterAddr)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill: Invalid eco adapter address`,
          properties: { expected: contracts.ecoAdapter, received: ecoAdapterAddr },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const [fillData] = decodeFill(adapterData)

    return fillData
  }

  private validateClaim(chainAction: ChainAction) {
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

    const { decodedCall } = this.validateRouterCall(chainAction.call)

    if (decodedCall.functionName !== 'routeFill') {
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
      (target: Address, data: Hex) => ({
        target,
        data,
      }),
    )

    if (routeClaimCalls.length === 1) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid route call - Only one call allowed`,
          properties: { calls: routeClaimCalls.length },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const contracts = this.rhinestoneConfigService.getContracts(chainAction.call.chainId)

    const { target: ecoAdapterAddr, data: adapterData } = routeClaimCalls[0]

    if (isAddressEqual(contracts.ecoAdapter, ecoAdapterAddr)) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Claim: Invalid eco adapter address`,
          properties: { expected: contracts.ecoAdapter, received: ecoAdapterAddr },
        }),
      )
      throw EcoError.InvalidRhinestoneRelayerAction
    }

    const fillData = decodeClaim(adapterData)

    const intent = extractIntent(fillData)

    return { intent, fillData }
  }

  private validateRouterCall(call: ChainCall) {
    const { router } = this.rhinestoneConfigService.getContracts(call.chainId)

    const isRouterCalled = isAddressEqual(router, call.to)
    const isValueZero = BigInt(call.value) === 0n

    if (!isRouterCalled || !isValueZero) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Failed to execute router call`,
          properties: { isRouterCalled, isValueZero },
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
