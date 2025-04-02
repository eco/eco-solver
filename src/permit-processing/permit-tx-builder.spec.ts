import { EcoTester } from '../common/test-utils/eco-tester/eco-tester'
import { encodeFunctionData, Hex } from 'viem'
import { PermitAbi } from '@/contracts/Permit.abi'
import { PermitProcessingParams } from './interfaces/permit-processing-params.interface'
import { PermitTxBuilder } from './permit-tx-builder'

let $: EcoTester
let builder: PermitTxBuilder

describe('PermitTxBuilder', () => {

  beforeAll(async () => {
    $ = EcoTester
      .setupTestFor(PermitTxBuilder)

    builder = await $.init<PermitTxBuilder>()
  })

  describe('getPermitTx', () => {
    it('should return correct tx data for valid input', () => {
      const params: PermitProcessingParams = {
        chainID: 1,
        owner: '0x1111111111111111111111111111111111111111',
        spender: '0x2222222222222222222222222222222222222222',
        value: 1000n,
        permit: {
          token: '0x3333333333333333333333333333333333333333',
          data: {
            deadline: '1700000000',
            signature:
              '0x' +
              'a'.repeat(64) + // r
              'b'.repeat(64) + // s
              '1c', // v = 28
          },
        },
      }

      const tx = builder.getPermitTx(params)

      const expectedData = encodeFunctionData({
        abi: PermitAbi,
        functionName: 'permit',
        args: [
          params.owner,
          params.spender,
          params.value,
          BigInt(params.permit.data.deadline),
          28,
          '0x' + 'a'.repeat(64) as Hex,
          '0x' + 'b'.repeat(64) as Hex,
        ],
      })

      expect(tx.to).toBe(params.permit.token)
      expect(tx.value).toBe(0n)
      expect(tx.data).toBe(expectedData)
    })

    it('should throw if signature is invalid length', () => {
      const params: PermitProcessingParams = {
        chainID: 1,
        owner: '0x1111111111111111111111111111111111111111',
        spender: '0x2222222222222222222222222222222222222222',
        value: 1000n,
        permit: {
          token: '0x3333333333333333333333333333333333333333',
          data: {
            deadline: '1700000000',
            signature: '0xdeadbeef',
          },
        },
      }

      expect(() => builder.getPermitTx(params)).toThrow(/Invalid signature length/)
    })
  })

  describe('splitSignature', () => {
    it('should correctly split a valid signature', () => {
      const sig =
        '0x' +
        'c'.repeat(64) + // r
        'd'.repeat(64) + // s
        '1b' // v = 27

      const result = (builder as any).splitSignature(sig)

      expect(result).toEqual({
        r: '0x' + 'c'.repeat(64),
        s: '0x' + 'd'.repeat(64),
        v: 27,
      })
    })

    it('should throw for bad signature length', () => {
      expect(() => (builder as any).splitSignature('0x1234')).toThrow(/Invalid signature length/)
    })
  })
})
