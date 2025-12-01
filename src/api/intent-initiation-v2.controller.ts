import { API_V2_ROOT, INTENT_INITIATION_ROUTE } from '@/common/routes/constants'
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger'
import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { GaslessIntentExecutionResponseDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response.dto'
import { GaslessIntentRequestV2DTO } from '@/quote/dto/v2/gasless-intent-request-v2.dto'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { IntentInitiationV2Service } from '@/intent-initiation/services/intent-initiation-v2.service'
import { QuoteErrorsInterface } from '@/quote/errors'

@ApiTags('Intent Initiation V2')
@Controller(API_V2_ROOT + INTENT_INITIATION_ROUTE)
export class IntentInitiationV2Controller {
  private logger = new Logger(IntentInitiationV2Controller.name)

  constructor(private readonly intentInitiationService: IntentInitiationV2Service) {}

  /*
   * Initiate Gasless Intent
   */
  @Post('/initiateGaslessIntent')
  @ApiOperation({
    summary: 'Initiate gasless intent execution (V2)',
    description:
      'Execute intents on behalf of the user using Permit3 for multi-chain token approvals. Handles all gas costs and intent publishing. Returns transaction details for successful submissions and error information for failures.',
  })
  @ApiBody({ type: GaslessIntentRequestV2DTO })
  @ApiResponse({
    status: 200,
    description: 'Gasless intent execution initiated successfully',
    type: GaslessIntentExecutionResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - check intent data, Permit3 signatures, and quote references',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - authentication required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - intent initiation failed',
  })
  async initiateGaslessIntent(
    @Body() gaslessIntentRequestDTO: GaslessIntentRequestV2DTO,
  ): Promise<GaslessIntentExecutionResponseDTO> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received Initiate Gasless Intent Request:`,
        properties: {
          gaslessIntentRequestDTO,
        },
      }),
    )

    const { response: gaslessIntentExecutionResponse, error } =
      await this.intentInitiationService.initiateGaslessIntent(gaslessIntentRequestDTO)

    if (!error) {
      return gaslessIntentExecutionResponse!
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
