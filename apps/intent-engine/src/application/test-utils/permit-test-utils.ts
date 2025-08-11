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
    const permitDTO: PermitDTO = {
      token: '0x0000000000000000000000000000000000000001',
      data: {
        signature: ('0x' + '1'.repeat(130)) as Hex,
        deadline: 9999999999n,
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
        spender: ('0x' + '0'.repeat(40)) as Hex,
        sigDeadline: 9999999999n,
      },
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
        spender: ('0x' + '0'.repeat(40)) as Hex,
        sigDeadline: 9999999999n,
      },
    }

    const getDetails = () =>
      opts.isBatch ? batchPermitData.typedData.details : [singlePermitData.typedData.details]

    const getSpender = () =>
      opts.isBatch ? batchPermitData.typedData.spender : singlePermitData.typedData.spender

    const getSigDeadline = () =>
      opts.isBatch ? batchPermitData.typedData.sigDeadline : singlePermitData.typedData.sigDeadline

    return {
      permitContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      signature: ('0x' + '1'.repeat(130)) as Hex,
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
