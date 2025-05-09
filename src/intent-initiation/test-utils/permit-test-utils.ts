/* eslint-disable prettier/prettier */
import { Hex } from 'viem'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'

export class PermitTestUtils {
  createPermitDTO(overrides?: Partial<PermitDTO>): PermitDTO {
    return {
      token: '0x0000000000000000000000000000000000000001',
      funder: '0x0000000000000000000000000000000000000003',
      spender: '0x0000000000000000000000000000000000000002',
      chainID: 1,
      value: 100n,
      signature: ('0x' + '1'.repeat(130)) as Hex,
      deadline: 9999999999n,
      ...overrides,
    }
  }

  createPermit2DTO(
    overrides: Partial<Permit2DTO> = {},
    opts: { token?: Hex; isBatch?: boolean } = {},
  ): Permit2DTO {
    const token = opts.token ?? '0x0000000000000000000000000000000000000001'
    const spender = ('0x' + '0'.repeat(40)) as Hex
    const funder = '0x0000000000000000000000000000000000000003' as Hex

    // New Permit2DTO structure based on the updated model
    return {
      chainID: 1,
      permitContract: '0x0000000000000000000000000000000000000002',
      details: [
        {
          token,
          amount: 1000n,
          expiration: '9999999999',
          nonce: '1',
        },
      ],
      funder,
      spender,
      sigDeadline: 9999999999n,
      signature: ('0x' + '1'.repeat(130)) as Hex,
      ...overrides,
    }
  }
}
