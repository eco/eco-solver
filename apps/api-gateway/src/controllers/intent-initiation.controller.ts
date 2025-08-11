import { API_ROOT, INTENT_INITIATION_ROUTE } from "@libs/shared"
import { Controller, Logger, Post, Body, InternalServerErrorException } from "@nestjs/common"
import { ApiOperation, ApiResponse } from "@nestjs/swagger"
import { IntentInitiationService, GaslessIntentRequestDTO, GaslessIntentResponseDTO, QuoteErrorsInterface } from "@libs/domain"
import { EcoLogMessage } from "@libs/shared"
import { getEcoServiceException } from "@libs/shared"

@Controller(API_ROOT + INTENT_INITIATION_ROUTE)
export class IntentInitiationController {
  private logger = new Logger(IntentInitiationController.name)


  constructor(
    private readonly intentInitiationService: IntentInitiationService
  ) {}

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
