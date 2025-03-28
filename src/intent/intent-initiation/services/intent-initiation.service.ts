import { EcoLogMessage } from '../../../common/logging/eco-log-message'
import { EcoResponse } from '../../../common/eco-response'
import { GaslessIntentRequestDTO } from '../../../quote/dto/gasless-intent-request.dto'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Permit2DTO } from '../../../quote/dto/permit2/permit2.dto'
import { PermitDTO } from '../../../quote/dto/permit/permit.dto'
import { RewardDTO } from '../../../quote/dto/reward.dto'

@Injectable()
export class IntentInitiationService implements OnModuleInit {
  private logger = new Logger(IntentInitiationService.name)

  constructor() {}

  onModuleInit() {}

  async initiateGaslessIntent(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<any>> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `createGaslessIntent`,
        properties: {
          gaslessIntentRequestDTO,
        },
      }),
    )

    return this.processPermitCalls(gaslessIntentRequestDTO)
  }

  private async processPermitCalls(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<any>> {
    const {
      reward,

      gaslessIntentData: {
        permitData: { permit, permit2 },
      },
    } = gaslessIntentRequestDTO

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `processPermitCalls: permits`,
        properties: {
          permit: permit || 'N/A',
          permit2: permit2 || 'N/A',
        },
      }),
    )

    let error: any

    if (permit) {
      ;({ error } = await this.executePermitCalls(permit!, reward))
    } else {
      ;({ error } = await this.executePermit2Calls(permit2!))
    }

    if (error) {
      return { error }
    }

    return {}
  }

  private async executePermitCalls(
    permits: PermitDTO[],
    reward: RewardDTO,
  ): Promise<EcoResponse<any>> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `executePermitCalls`,
        properties: {
          permits,
        },
      }),
    )

    const permitMap: Record<string, PermitDTO> = {}

    for (const permit of permits) {
      permitMap[permit.token.toLowerCase()] = permit
    }

    // Iterate over the reward tokens and call permit on that token contract if there exists a permit with a matching token address
    const { tokens } = reward
    for (const token of tokens) {
      const tokenPermit = permitMap[token.token.toLowerCase()]

      if (tokenPermit) {
        // Call permit on the token contract
      }
    }

    return {}
  }

  private async executePermit2Calls(permit: Permit2DTO): Promise<EcoResponse<any>> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `executePermit2Calls`,
        properties: {
          permit,
        },
      }),
    )

    const { singlePermitData, batchPermitData } = permit.permitData

    // const signer =
    let permit2Contract: any // = new ethers.Contract(permit.permitContract, permit2Abi, signer)

    if (singlePermitData) {
      const { details, spender, sigDeadline } = singlePermitData.typedData
      await permit2Contract.permitTransferFrom(details, spender, sigDeadline, permit.signature)
    }

    if (batchPermitData) {
      const { details, spender, sigDeadline } = batchPermitData.typedData
      await permit2Contract.permitTransferFrom(details, spender, sigDeadline, permit.signature)
    }

    return {}
  }
}
