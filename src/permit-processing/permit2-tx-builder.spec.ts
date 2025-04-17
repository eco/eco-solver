import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { encodeFunctionData, zeroAddress } from 'viem'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2SinglePermitAbi, Permit2BatchPermitAbi } from '@/permit-processing/permit2-abis'
import { Permit2TxBuilder } from '@/permit-processing/permit2-tx-builder'
import { Permit2TypedDataDetailsDTO } from '@/quote/dto/permit2/permit2-typed-data-details.dto'

const address1 = '0x8c182a808f75a29c0f02d4ba80ab236ab01c0ace' as const
const address2 = '0x577f7c37beC658F9035E88246f200dE361C33685' as const
const spender = '0x56a627A193Bf2E1557D4DA4Fb32C2D85ED55b12c' as const
const permitContract = '0xa01691374E1cCB6e7274dE4b76d1B6344cC73e22' as const

let $: EcoTester
let builder: Permit2TxBuilder

describe('Permit2TxBuilder', () => {
  beforeAll(async () => {
    $ = EcoTester.setupTestFor(Permit2TxBuilder)

    builder = await $.init<Permit2TxBuilder>()
  })

  const singlePermitDetail: Permit2TypedDataDetailsDTO = {
    token: address1,
    amount: '1000',
    nonce: '1',
    expiration: '9999999999',
  }

  const batchPermitDetails: Permit2TypedDataDetailsDTO[] = [
    {
      token: address1,
      amount: '1000',
      nonce: '1',
      expiration: '9999999999',
    },
    {
      token: address2,
      amount: '2000',
      nonce: '1',
      expiration: '9999999999',
    },
  ]

  const commonPermitProps = {
    signature: '0x' + '1'.repeat(130),
    getSpender: () => spender,
    getSigDeadline: () => '9999999999',
  }

  it('builds single permit2 tx', () => {
    const permit = {
      permitContract,
      signature: commonPermitProps.signature,
      permitData: {
        ...commonPermitProps,
        batchPermitData: undefined,
        getDetails: () => [singlePermitDetail],
        getSpender: () => spender,
      },
    } as unknown as Permit2DTO

    const tx = builder.getPermit2Tx(zeroAddress, permit)

    const expectedData = encodeFunctionData({
      abi: Permit2SinglePermitAbi,
      functionName: 'permit',
      args: [
        zeroAddress,
        {
          details: {
            token: address1,
            amount: 1000n,
            nonce: 1,
            expiration: 9999999999,
          },
          spender,
          sigDeadline: 9999999999n,
        },
        permit.signature,
      ],
    })

    expect(tx).toEqual({
      to: permitContract,
      data: expectedData,
      value: 0n,
    })
  })

  it('builds batch permit2 tx', () => {
    const permit = {
      permitContract,
      signature: commonPermitProps.signature,
      permitData: {
        ...commonPermitProps,
        batchPermitData: true,
        getDetails: () => batchPermitDetails,
      },
    } as unknown as Permit2DTO

    const tx = builder.getPermit2Tx(zeroAddress, permit)

    const expectedData = encodeFunctionData({
      abi: Permit2BatchPermitAbi,
      functionName: 'permit',
      args: [
        zeroAddress,
        {
          details: [
            { token: address1, amount: 1000n, nonce: 1, expiration: 9999999999 },
            { token: address2, amount: 2000n, nonce: 2, expiration: 9999999999 },
          ],
          spender,
          sigDeadline: 9999999999n,
        },
        
        permit.signature,
      ],
    })

    expect(tx).toEqual({
      to: permitContract,
      data: expectedData,
      value: 0n,
    })
  })
})
