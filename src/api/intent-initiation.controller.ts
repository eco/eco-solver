import { API_ROOT, INTENT_INITIATION_ROUTE } from '@/common/routes/constants'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { GaslessIntentResponseDTO } from '@/intent-initiation/dtos/gasless-intent-response.dto'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { QuoteErrorsInterface } from '@/quote/errors'

@Controller(API_ROOT + INTENT_INITIATION_ROUTE)
export class IntentInitiationController {
  private logger = new Logger(IntentInitiationController.name)

  constructor(private readonly intentInitiationService: IntentInitiationService) {}

  /*
   * Initiate Gasless Intent
   */
  @ApiOperation({
    summary: 'Initiate Gasless Intent',
  })
  @Post('/initiateGaslessIntent')
  @ApiResponse({ type: GaslessIntentResponseDTO, isArray: true })
  async initiateGaslessIntent(
    @Body() gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<GaslessIntentResponseDTO[]> {
    // Using any to accommodate the actual returned transaction receipt structure
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received Initiate Gasless Intent Request:`,
        properties: {
          gaslessIntentRequestDTO,
        },
      }),
    )

    const { response, error } =
      await this.intentInitiationService.initiateGaslessIntent(gaslessIntentRequestDTO)

    if (!error) {
      return response!
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
