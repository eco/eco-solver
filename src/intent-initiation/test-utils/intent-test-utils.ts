/* eslint-disable prettier/prettier */
import { GaslessIntentDataDTO } from '../../quote/dto/gasless-intent-data.dto'
import { GaslessIntentRequestDTO } from '../../quote/dto/gasless-intent-request.dto'
import { Hex } from 'viem'
import { PermitTestUtils } from './permit-test-utils'
import { QuoteTestUtils } from './quote-test-utils'
import { RewardDTO } from '../../quote/dto/reward.dto'
import { ZeroAddress } from 'ethers'

export interface GaslessIntentFactoryOptions extends Partial<GaslessIntentRequestDTO> {
  usePermit?: boolean
  isBatchPermit2?: boolean
  token?: `0x${string}`
}

export class IntentTestUtils {
  private permitTestUtils: PermitTestUtils = new PermitTestUtils()
  private quoteTestUtils: QuoteTestUtils = new QuoteTestUtils()

  constructor() {
  }

  createRewardDTO(overrides: Partial<RewardDTO> & { token?: Hex } = {}): RewardDTO {

    const {
      token,
      tokens = token ? [{ token, amount: '1000' }] : [],
      ...rest
    } = overrides

    return {
      creator: '0x0000000000000000000000000000000000000006',
      prover: '0x0000000000000000000000000000000000000007',
      deadline: '9999999999',
      nativeValue: '0',
      tokens,
      ...rest,
    }
  }

  createGaslessIntentRequestDTO(overrides: GaslessIntentFactoryOptions = {}): GaslessIntentRequestDTO {

    const {
      usePermit = true,
      isBatchPermit2 = false,
      token,
      ...dtoOverrides
    } = overrides

    const gaslessIntentData: GaslessIntentDataDTO = {
      funder: '0x8c182a808f75a29c0f02d4ba80ab236ab01c0ace',
      permitData: {
        permit: usePermit ? [this.permitTestUtils.createPermitDTO({ token })] : [],
        permit2: usePermit ? undefined : this.permitTestUtils.createPermit2DTO({}, { isBatch: isBatchPermit2, token }),

        getPermitContractAddress(): Hex {
          return (this.permit ? ZeroAddress : this.permit2!.permitContract) as Hex
        }
      },

      getPermitContractAddress(): Hex {
        return this.permitData.getPermitContractAddress() as Hex
      }
    }

    const gaslessIntentRequestDTO: GaslessIntentRequestDTO = {
      originChainID: 1,
      destinationChainID: 137,
      route: this.quoteTestUtils.createQuoteRouteDataDTO(),
      salt: '0x' + 'abcd'.padEnd(64, '0') as Hex,
      reward: this.createRewardDTO({ token }),
      gaslessIntentData,
      ...dtoOverrides,

      getFunder(): Hex {
        return this.gaslessIntentData.funder
      },

      getPermitContractAddress(): Hex {
        return this.gaslessIntentData.getPermitContractAddress() as Hex
      },
    }

    return gaslessIntentRequestDTO
  }
}
