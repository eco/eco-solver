import { API_ROOT, INTENT_INITIATION_ROUTE } from '@/common/routes/constants'
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger'
import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { GaslessIntentExecutionResponseDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response.dto'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { GaslessIntentTransactionDataDTO } from '@/intent-initiation/dtos/gasless-intent-transaction-data.dto'
import { GaslessIntentTransactionDataRequestDTO } from '@/intent-initiation/dtos/gasless-intent-transaction-data-request.dto'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { QuoteErrorsInterface } from '@/quote/errors'

@ApiTags('Intent Initiation V1')
@Controller(API_ROOT + INTENT_INITIATION_ROUTE)
export class IntentInitiationController {
  private logger = new Logger(IntentInitiationController.name)

  constructor(private readonly intentInitiationService: IntentInitiationService) {}

  /*
   * Initiate Gasless Intent
   */
  @Post('/initiateGaslessIntent')
  @ApiOperation({
    summary: 'Initiate gasless intent execution',
    description:
      'Execute intents on behalf of the user, handling gas costs and intent publishing. Requires permit signatures for token approvals. Returns transaction hashes for successful submissions and error details for failures.',
  })
  @ApiBody({ type: GaslessIntentRequestDTO })
  @ApiResponse({
    status: 200,
    description: 'Gasless intent execution initiated successfully',
    type: GaslessIntentExecutionResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - check intent data, permit signatures, and quote references',
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
    @Body() gaslessIntentRequestDTO: GaslessIntentRequestDTO,
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

  /*
   * Get Gasless Intent Transaction Data
   */
  @Post('/getGaslessIntentTransactionData')
  @ApiOperation({
    summary: 'Get transaction data for gasless intent',
    description:
      'Retrieve transaction details for a previously initiated gasless intent. Returns destination chain transaction hash and chain ID for tracking fulfillment status.',
  })
  @ApiBody({ type: GaslessIntentTransactionDataRequestDTO })
  @ApiResponse({
    status: 200,
    description: 'Transaction data retrieved successfully',
    type: GaslessIntentTransactionDataDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - check intent group ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Intent group not found or not yet fulfilled',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - failed to retrieve transaction data',
  })
  async getDestinationChainTransactionHash(
    @Body() gaslessIntentTransactionDataRequestDTO: GaslessIntentTransactionDataRequestDTO,
  ): Promise<GaslessIntentTransactionDataDTO> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Received Get Gasless Intent Transaction Data Request:`,
        properties: {
          gaslessIntentTransactionDataRequestDTO,
        },
      }),
    )

    const { response: gaslessIntentTransactionDataDTO, error } =
      await this.intentInitiationService.getGaslessIntentTransactionData(
        gaslessIntentTransactionDataRequestDTO,
      )

    if (!error) {
      return gaslessIntentTransactionDataDTO!
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
