import { API_ROOT, INTENT_INITIATION_ROUTE } from '@/common/routes/constants'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Body, Controller, InternalServerErrorException, Logger, Post } from '@nestjs/common'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { QuoteErrorsInterface } from '@/quote/errors'
import { TransactionReceipt } from 'viem'

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
        // If it's *already* an error, stop fucking around. Wasted an hour on this crap.
        throw error
      }

      // Also throw if error has no statusCode
      throw new InternalServerErrorException(error)
    }

    return txReceipt!
  }
}
