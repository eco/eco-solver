/* eslint-disable prettier/prettier */
import { GaslessIntentDataDTO } from '@/quote/dto/gasless-intent-data.dto'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { Hex } from 'viem'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { PermitTestUtils } from '@/intent-initiation/test-utils/permit-test-utils'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'

export interface GaslessIntentFactoryOptions extends Partial<GaslessIntentRequestDTO> {
  usePermit?: boolean
  isBatchPermit2?: boolean
  token?: `0x${string}`
  gaslessIntentData?: Partial<GaslessIntentDataDTO>
}

export class IntentTestUtils {
  private permitTestUtils: PermitTestUtils = new PermitTestUtils()
  private quoteTestUtils: QuoteTestUtils = new QuoteTestUtils()

  constructor() {}

  createRewardDTO(
    overrides: Partial<QuoteRewardDataDTO> & { token?: Hex } = {},
  ): QuoteRewardDataDTO {
    const { token, tokens = token ? [{ token, amount: 1000n }] : [], ...rest } = overrides

    return {
      creator: '0x0000000000000000000000000000000000000006',
      prover: '0x0000000000000000000000000000000000000007',
      deadline: 9999999999n,
      nativeValue: 0n,
      tokens,
      ...rest,
    }
  }

  createGaslessIntentDataDTO(
    gaslessIntentFactoryOptions: GaslessIntentFactoryOptions = {},
    permit2Overrides: Partial<Permit2DTO> = {},
  ): GaslessIntentDataDTO {
    const { usePermit = true, isBatchPermit2 = false, token } = gaslessIntentFactoryOptions

    const gaslessIntentData: GaslessIntentDataDTO = {
      permitData: {
        permit: usePermit ? [this.permitTestUtils.createPermitDTO({ token })] : [],
        permit2: usePermit
          ? undefined
          : [this.permitTestUtils.createPermit2DTO(permit2Overrides, { isBatch: isBatchPermit2, token })],
        permit3: undefined,
      },

      allowPartial: false,
    }

    return gaslessIntentData
  }

  createGaslessIntentRequestDTO(
    overrides: GaslessIntentFactoryOptions = {},
  ): GaslessIntentRequestDTO {
    const { usePermit = true, isBatchPermit2 = false, token, ...dtoOverrides } = overrides

    const gaslessIntentData: GaslessIntentDataDTO = overrides.gaslessIntentData ?? {
      permitData: {
        permit: usePermit ? [this.permitTestUtils.createPermitDTO({ token })] : [],
        permit2: usePermit
          ? undefined
          : [this.permitTestUtils.createPermit2DTO({}, { isBatch: isBatchPermit2, token })],
        permit3: undefined,
      },

      allowPartial: false,
    }

    const gaslessIntentRequestDTO: GaslessIntentRequestDTO = {
      dAppID: 'test',
      intents: [
        {
          quoteID: 'QuoteID',
          salt: ('0x' + 'abcd'.padEnd(64, '0')) as Hex,
          route: this.quoteTestUtils.createQuoteRouteDataDTO(),
          reward: this.createRewardDTO({ token }),
        },
      ],
      gaslessIntentData,
      ...dtoOverrides,
    }

    return gaslessIntentRequestDTO
  }
}
