import { API_ROOT, INTENT_INITIATION_ROUTE } from '../../common/routes/constants'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import { GaslessIntentRequestDTO } from '../../quote/dto/gasless-intent-request.dto'
import { IntentInitiationService } from '../services/intent-initiation.service'
import { QuoteErrorsInterface } from '../../quote/errors'
import { serialize } from 'v8'
import { TransactionReceipt } from 'viem'

import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Logger,
  Post,
} from '@nestjs/common'

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
  @ApiResponse({ type: GaslessIntentRequestDTO })
  async initiateGaslessIntent(
    @Body() gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<TransactionReceipt> {
    const { response: txReceipt, error } =
      await this.intentInitiationService.initiateGaslessIntent(gaslessIntentRequestDTO)

    if (error) {
      const errorStatus = (error as QuoteErrorsInterface).statusCode
      if (errorStatus) {
        switch (errorStatus) {
          case 400:
            throw new BadRequestException(serialize(error))
          case 500:
          default:
            throw new InternalServerErrorException(serialize(error))
        }
      }

      // 💥 FIX: throw if error has no statusCode
      throw new InternalServerErrorException(serialize(error))
    }

    return txReceipt!
  }
}
