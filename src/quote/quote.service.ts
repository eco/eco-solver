import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class QuoteService implements OnApplicationBootstrap {
  private logger = new Logger(QuoteService.name)

  constructor(private readonly ecoConfigService: EcoConfigService) {}

  async onApplicationBootstrap() {}

  async getQuote(quoteIntentDataDTO: QuoteIntentDataDTO) {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Getting quote for intent`,
        properties: {
          quoteIntentDataDTO,
        },
      }),
    )
    this.storeQuoteIntentData(quoteIntentDataDTO)

    const solver = this.ecoConfigService.getSolver(quoteIntentDataDTO.route.destination)
    return
  }

  storeQuoteIntentData(quoteIntentDataDTO: QuoteIntentDataDTO) {
    throw new Error('Method not implemented.')
  }
}
