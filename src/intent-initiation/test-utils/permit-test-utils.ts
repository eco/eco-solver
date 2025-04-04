/* eslint-disable prettier/prettier */
import { BatchPermitDataDTO } from '@/quote/dto/permit2/batch-permit-data.dto'
import { Hex } from 'viem'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { SinglePermitDataDTO } from '@/quote/dto/permit2/single-permit-data.dto'

export class PermitTestUtils {
  createPermitDTO(overrides?: Partial<PermitDTO>): PermitDTO {

    const permitDTO: PermitDTO = {
      token: '0x0000000000000000000000000000000000000001',
      data: {
        signature: '0x' + '1'.repeat(130) as Hex,
        deadline: '9999999999',
      },
      ...overrides,
    }

    return permitDTO
  }

  createPermit2DTO(
    overrides: Partial<Permit2DTO> = {},
    opts: { token?: Hex; isBatch?: boolean } = {},
  ): Permit2DTO {
    const token = opts.token ?? '0x0000000000000000000000000000000000000001'

    const singlePermitData: SinglePermitDataDTO = {
      typedData: {
        details: {
          token,
          amount: '1000',
          nonce: '1',
          expiration: '9999999999',
        },
        spender: '0x' + '0'.repeat(40) as Hex,
        sigDeadline: '9999999999',
      }
    }

    const batchPermitData: BatchPermitDataDTO = {
      // permitDataType: 'batch',
      typedData: {
        details: [
          {
            token,
            amount: '1000',
            nonce: '1',
            expiration: '9999999999',
          },
        ],
        spender: '0x' + '0'.repeat(40) as Hex,
        sigDeadline: '9999999999',
      },
    }

    const getDetails = () =>
      opts.isBatch ? batchPermitData.typedData.details : [singlePermitData.typedData.details]

    const getSpender = () =>
      opts.isBatch ? batchPermitData.typedData.spender : singlePermitData.typedData.spender

    const getSigDeadline = () =>
      opts.isBatch ? batchPermitData.typedData.sigDeadline : singlePermitData.typedData.sigDeadline

    return {
      permitContract: '0x0000000000000000000000000000000000000002',
      signature: '0x' + '1'.repeat(130) as Hex,
      permitData: {
        singlePermitData: opts.isBatch ? undefined : singlePermitData,
        batchPermitData: opts.isBatch ? batchPermitData : undefined,
        getDetails: getDetails,
        getSpender: getSpender,
        getSigDeadline: getSigDeadline,
      },
      ...overrides,
    }
  }
}
