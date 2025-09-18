import { API_ROOT, INTENT_INITIATION_ROUTE } from '@/common/routes/constants'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { GaslessIntentExecutionResponseDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response.dto'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { GaslessIntentTransactionDataDTO } from '@/intent-initiation/dtos/gasless-intent-transaction-data.dto'
import { GaslessIntentTransactionDataRequestDTO } from '@/intent-initiation/dtos/gasless-intent-transaction-data-request.dto'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { LogOperation } from '@/common/logging/decorators/log-operation.decorator'
import { IntentOperationLogger } from '@/common/logging/loggers/intent-operation-logger'
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
  @ApiResponse({ type: GaslessIntentExecutionResponseDTO })
  @LogOperation('initiate_gasless_intent', IntentOperationLogger)
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
  @ApiOperation({
    summary: 'Get Gasless Intent Transaction Data',
  })
  @Post('/getGaslessIntentTransactionData')
  @ApiResponse({ type: GaslessIntentTransactionDataDTO })
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
