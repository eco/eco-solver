import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRewardDataModel } from '@/quote/schemas/quote-reward.schema'
import { QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'

export class QuoteTestUtils {
  createQuoteIntentModel(overrides?: Partial<QuoteIntentModel>): QuoteIntentModel {
    const quoteIntentModel: QuoteIntentModel = {
      _id: 'quote-id',
      dAppID: 'app-id',
      route: {
        salt: '0x' + '0'.repeat(64),
        source: 1,
        destination: 137,
        inbox: '0x0000000000000000000000000000000000000005',
        tokens: [],
        calls: [],
      },
      reward: {
        creator: '0x0000000000000000000000000000000000000006',
        prover: '0x0000000000000000000000000000000000000007',
        deadline: 9999999999n,
        nativeValue: 0n,
        tokens: [],
      } as QuoteRewardDataModel,
      ...overrides,
    } as unknown as QuoteIntentModel

    return quoteIntentModel
  }

  createQuoteIntentDataDTO(overrides?: Partial<QuoteIntentDataDTO>): QuoteIntentDataDTO {
    const quoteIntentDataDTO: QuoteIntentDataDTO = {
      intentExecutionTypes: [
        IntentExecutionType.GASLESS.toString(),
        IntentExecutionType.SELF_PUBLISH.toString(),
      ],

      dAppID: 'app-id',
      route: {
        salt: '0x' + '0'.repeat(64),
        source: 1,
        destination: 137,
        inbox: '0x0000000000000000000000000000000000000005',
        tokens: [],
        calls: [],
      },
      reward: {
        creator: '0x0000000000000000000000000000000000000006',
        prover: '0x0000000000000000000000000000000000000007',
        deadline: 9999999999n,
        nativeValue: 0n,
        tokens: [],
      } as QuoteRewardDataModel,
      ...overrides,
    } as QuoteIntentDataDTO

    return quoteIntentDataDTO
  }

  asQuoteIntentModel(dto: GaslessIntentRequestDTO): QuoteIntentModel {
    return this.createQuoteIntentModel({
      route: dto.route,
      reward: {
        creator: dto.reward.creator as `0x${string}`,
        prover: dto.reward.prover as `0x${string}`,
        deadline: BigInt(dto.reward.deadline),
        nativeValue: BigInt(dto.reward.nativeValue),
        tokens: dto.reward.tokens.map((t) => ({
          token: t.token as `0x${string}`,
          amount: BigInt(t.amount),
        })),
      },
    })
  }

  createQuoteRouteDataDTO(overrides: Partial<QuoteRouteDataDTO> = {}): QuoteRouteDataDTO {
    const quoteRouteDataDTO: QuoteRouteDataDTO = {
      source: 1n,
      destination: 137n,
      inbox: '0x0000000000000000000000000000000000000005',
      tokens: [],
      calls: [],
      ...overrides,
    }

    return quoteRouteDataDTO
  }

  createQuoteRewardDataDTO(overrides: Partial<QuoteRewardDataModel> = {}): QuoteRewardDataModel {
    const quoteRewardDataDTO: QuoteRewardDataDTO = {
      creator: '0x0000000000000000000000000000000000000006',
      prover: '0x0000000000000000000000000000000000000007',
      deadline: 9999999999n,
      nativeValue: 0n,
      tokens: [],
      ...overrides,
    }

    return quoteRewardDataDTO
  }
}
