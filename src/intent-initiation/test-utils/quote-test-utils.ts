import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { Hex } from 'viem'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { QuoteDataEntryDTO } from '@/quote/dto/quote-data-entry.dto'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRewardDataModel } from '@/quote/schemas/quote-reward.schema'
import { QuoteRouteDataDTO, QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { hashRoute, RouteType } from '@eco-foundation/routes-ts'
import * as crypto from 'crypto'
import { Types } from 'mongoose'

const AddressLen = 40
const ZERO_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000'

export class QuoteTestUtils {
  getRandomHexString(len: number): string {
    return crypto.randomBytes(len / 2).toString('hex')
  }

  getRandomAddress(): Hex {
    return `0x${this.getRandomHexString(AddressLen)}`
  }

  createQuoteIntentModel(overrides?: Partial<QuoteIntentModel>): QuoteIntentModel {
    const quoteIntentModel: QuoteIntentModel = {
      _id: 'quote-id',
      dAppID: 'app-id',
      intentExecutionType: IntentExecutionType.GASLESS.toString(),
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

  createQuoteDataEntryDTO(overrides?: Partial<QuoteDataEntryDTO>): QuoteDataEntryDTO {
    const quoteDataEntryDTO: QuoteDataEntryDTO = {
      intentExecutionType: IntentExecutionType.GASLESS.toString(),
      routeTokens: [],
      routeCalls: [],
      rewardTokens: [],
      expiryTime: '9999999999',
      ...overrides,
    }

    return quoteDataEntryDTO
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

  getQuoteIntentModel(
    intentExecutionType: string,
    quoteIntentDataDTO: QuoteIntentDataDTO,
  ): QuoteIntentModel {
    const { dAppID, route: quoteRoute, reward } = quoteIntentDataDTO

    // Create the model without casting to avoid TypeScript error
    return {
      _id: 'mock-id' as any,
      quoteID: quoteIntentDataDTO.quoteID,
      dAppID,
      intentExecutionType,
      route: quoteRoute,
      reward,
      receipt: null,
    }
  }

  private getRouteHash(quoteRoute: QuoteRouteDataInterface): string {
    // Hash the route using a bogus zero hash
    const saltedRoute: RouteType = {
      ...quoteRoute,
      salt: ZERO_SALT,
    }

    return hashRoute(saltedRoute)
  }

  asQuoteIntentModel(dto: GaslessIntentRequestDTO): QuoteIntentModel {
    if (!dto.intents || dto.intents.length === 0) {
      throw new Error('GaslessIntentRequestDTO must have at least one intent')
    }

    // Use the first intent from the array
    const intent = dto.intents[0]

    return this.createQuoteIntentModel({
      dAppID: dto.dAppID,
      route: intent.route,
      reward: intent.reward,
    })
  }

  createQuoteRouteDataDTO(overrides: Partial<QuoteRouteDataDTO> = {}): QuoteRouteDataDTO {
    return {
      source: 1n,
      destination: 137n,
      salt: ZERO_SALT,
      inbox: '0x0000000000000000000000000000000000000005',
      tokens: [],
      calls: [],
      ...overrides,
    }
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
