const mockDecodeFunctionData = jest.fn()
import { EcoError } from '@/common/errors/eco-error'
import { getFunctionBytes } from '@/common/viem/contracts'
import { CallDataInterface } from '@/contracts'
import { getTransactionTargetData, getWaitForTransactionTimeout } from '@/intent/utils'

jest.mock('viem', () => {
  return {
    ...jest.requireActual('viem'),
    decodeFunctionData: mockDecodeFunctionData,
  }
})

const address1 = '0x1111111111111111111111111111111111111111'
describe('utils tests', () => {
  describe('on getTransactionTargetData', () => {
    const callData: CallDataInterface = { target: address1, data: '0xa9059cbb3333333', value: 0n } //transfer selector plus data fake
    const selectors = ['transfer(address,uint256)']
    const targetConfig = { contractType: 'erc20', selectors }
    const decodedData = { stuff: true }

    it('should throw when no target config exists on solver', async () => {
      const solver = { targets: {} }
      expect(() => getTransactionTargetData(solver as any, callData)).toThrow(
        EcoError.IntentSourceTargetConfigNotFound(callData.target as string),
      )
    })

    it('should return null when tx is not decoded ', async () => {
      mockDecodeFunctionData.mockReturnValue(null)
      expect(
        getTransactionTargetData(
          { targets: { [address1]: { contractType: 'erc20', selectors } } } as any,
          callData,
        ),
      ).toBe(null)
    })

    it('should return null when target selector is not supported by the solver', async () => {
      const fakeData = '0xaaaaaaaa11112333'
      const call: CallDataInterface = { target: callData.target, data: fakeData, value: 0n }
      mockDecodeFunctionData.mockReturnValue(decodedData)
      expect(
        getTransactionTargetData(
          { targets: { [address1]: { contractType: 'erc20', selectors } } } as any,
          call,
        ),
      ).toBe(null)
    })

    it('should return the decoded function data, selctor and target config when successful', async () => {
      mockDecodeFunctionData.mockReturnValue(decodedData)
      expect(
        getTransactionTargetData({ targets: { [address1]: targetConfig } } as any, callData),
      ).toEqual({
        decodedFunctionData: decodedData,
        selector: getFunctionBytes(callData.data),
        targetConfig,
      })
    })
  })

  describe('on getWaitForTransactionTimeout', () => {
    it('should return the timeout for mainnet', () => {
      expect(getWaitForTransactionTimeout(1n)).toEqual(1000 * 60 * 5)
    })
    it('should return undefined for other chains', () => {
      expect(getWaitForTransactionTimeout(2n)).toEqual(undefined)
      expect(getWaitForTransactionTimeout(137n)).toEqual(undefined)
      expect(getWaitForTransactionTimeout(84523n)).toEqual(undefined)
    })
  })
})
