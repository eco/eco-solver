import { Hex } from 'viem'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { PermitParams } from '@/intent-initiation/permit-validation/interfaces/permit-params.interface'
import * as crypto from 'crypto'

const AddressLen = 40

export class PermitTestUtils {
  getRandomAddress(): Hex {
    return `0x${this.getRandomHexString(AddressLen)}`
  }

  getRandomHexString(len: number): string {
    return crypto.randomBytes(len / 2).toString('hex')
  }

  createPermitParams(overrides?: Partial<PermitParams>): PermitParams {
    const permitParams: PermitParams = {
      tokenAddress: this.getRandomAddress(),
      owner: this.getRandomAddress(),
      spender: this.getRandomAddress(),
      value: 0n,
      signature: ('0x' + '1'.repeat(130)) as Hex,
      deadline: 9999999999n,
      nonce: 1n,
      ...overrides,
    }

    return permitParams
  }

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
      permitContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
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
