import { API_ROOT, INTENT_INITIATION_ROUTE } from '@eco-solver/common/routes/constants'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import {
  Body,
  Controller,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  Post,
} from '@nestjs/common'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { GaslessIntentRequestDTO } from '@eco-solver/quote/dto/gasless-intent-request.dto'
import { GaslessIntentResponseDTO } from '@eco-solver/intent-initiation/dtos/gasless-intent-response.dto'
import { getEcoServiceException } from '@eco-solver/common/errors/eco-service-exception'
import { IntentInitiationService } from '@eco-solver/intent-initiation/services/intent-initiation.service'
import { ModuleRef } from '@nestjs/core'
import { QuoteErrorsInterface } from '@eco-solver/quote/errors'

@Controller(API_ROOT + INTENT_INITIATION_ROUTE)
export class IntentInitiationController implements OnModuleInit {
  private logger = new Logger(IntentInitiationController.name)
  private intentInitiationService: IntentInitiationService

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    this.intentInitiationService = this.moduleRef.get(IntentInitiationService, { strict: false })
  }

  /*
   * Initiate Gasless Intent
   */
  @ApiOperation({
    summary: 'Initiate Gasless Intent',
  })
  @Post('/initiateGaslessIntent')
  @ApiResponse({ type: GaslessIntentResponseDTO })
  async initiateGaslessIntent(
    @Body() gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<GaslessIntentResponseDTO> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received Initiate Gasless Intent Request:`,
        properties: {
          gaslessIntentRequestDTO,
        },
      }),
    )

    const { response: txReceipt, error } =
      await this.intentInitiationService.initiateGaslessIntent(gaslessIntentRequestDTO)

    if (!error) {
      return txReceipt!
    }

    const errorStatus = (error as QuoteErrorsInterface).statusCode

    if (errorStatus) {
      throw getEcoServiceException({ error })
    }

    // Also throw a generic InternalServerErrorException if error has no statusCode
    throw getEcoServiceException({
      httpExceptionClass: InternalServerErrorException,
      error: { message: JSON.stringify(error) },
    })
  }
}
