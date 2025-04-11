import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { Hex } from 'viem'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { QuoteDataEntryDTO } from '@/quote/dto/quote-data-entry.dto'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRewardDataModel } from '@/quote/schemas/quote-reward.schema'
import { QuoteRouteDataDTO, QuoteRouteDataInterface } from '@/quote/dto/quote.route.data.dto'
import { RouteType, hashRoute } from '@eco-foundation/routes-ts'
import * as crypto from 'crypto'

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

    const quoteIntentModel: QuoteIntentModel = {
      dAppID,
      intentExecutionType,
      // routeHash: this.getRouteHash(quoteRoute),
      route: quoteRoute,
      reward,
    } as QuoteIntentModel

    return quoteIntentModel
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
