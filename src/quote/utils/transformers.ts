import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { IntentSourceModel, IntentSourceStatus } from '@/intent/schemas/intent-source.schema'

const ZERO_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000'

export function quoteIntentToIntentSource(quoteIntent: QuoteIntentModel): IntentSourceModel {
  return {
    intent: {
      ...quoteIntent,
      route: {
        ...quoteIntent.route,
        salt: ZERO_SALT,
      },
      hash: '0x', // Placeholder hash
      funder: '0x', // Placeholder funder
      logIndex: 0, // Placeholder logIndex
    },
    status: 'PENDING' as IntentSourceStatus,
    receipt: {} as any,
  } as IntentSourceModel
}

export function getGaslessIntentRequest(
  quoteIntentDataDTO: QuoteIntentDataDTO,
): GaslessIntentRequestDTO {
  return {
    quoteID: quoteIntentDataDTO.quoteID,
    dAppID: quoteIntentDataDTO.dAppID,
    salt: ZERO_SALT,
    route: quoteIntentDataDTO.route,
    reward: quoteIntentDataDTO.reward,
    gaslessIntentData: quoteIntentDataDTO.gaslessIntentData!,
  }
}
