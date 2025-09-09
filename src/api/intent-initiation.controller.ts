import { API_ROOT, INTENT_INITIATION_ROUTE } from '@/common/routes/constants'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import {
  Body,
  Controller,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  Post,
} from '@nestjs/common'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { GaslessIntentResponseDTO } from '@/intent-initiation/dtos/gasless-intent-response.dto'
import { getEcoServiceException } from '@/common/errors/eco-service-exception'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { ModuleRef } from '@nestjs/core'
import { LogOperation } from '@/common/logging/decorators/log-operation.decorator'
import { LogContext } from '@/common/logging/decorators/log-context.decorator'
import { IntentOperationLogger } from '@/common/logging/loggers/intent-operation-logger'
import { QuoteErrorsInterface } from '@/quote/errors'

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
  @LogOperation('initiate_gasless_intent', IntentOperationLogger)
  async initiateGaslessIntent(
    @Body() @LogContext gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<GaslessIntentResponseDTO> {
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
