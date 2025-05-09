import { PermitProcessor } from '@/common/permit/permit-processor'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { encodeFunctionData, parseSignature, Hex } from 'viem'
import { PermitAbi } from '@/contracts/Permit.abi'
import { EcoError } from '@/common/errors/eco-error'

jest.mock('viem', () => {
  const originalModule = jest.requireActual('viem')
  return {
    ...originalModule,
    encodeFunctionData: jest.fn().mockImplementation((params) => {
      if (params.functionName === 'permit') {
        return '0xEncoded_Permit_Data' as Hex
      }
      return '0xDefault_Encoded_Data' as Hex
    }),
    parseSignature: jest.fn().mockReturnValue({
      r: '0x1234567890123456789012345678901234567890123456789012345678901234' as Hex,
      s: '0x5678901234567890123456789012345678901234567890123456789012345678' as Hex,
      v: 27,
    }),
  }
})

describe('PermitProcessor', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateTxs', () => {
    it('should generate transaction data for a single permit', () => {
      // Create a test PermitDTO
      const permitDTO: PermitDTO = {
        chainID: 1,
        funder: '0x0000000000000000000000000000000000000001' as Hex,
        spender: '0x0000000000000000000000000000000000000002' as Hex,
        token: '0x0000000000000000000000000000000000000003' as Hex,
        signature: '0x1234567890abcdef' as Hex,
        deadline: 9999999999n,
        value: 1000n,
      }

      // Call the processor method
      const result = PermitProcessor.generateTxs(permitDTO)

      // Verify the transaction object is correctly formed
      expect(result).toEqual({
        response: [
          {
            to: permitDTO.token,
            data: '0xEncoded_Permit_Data',
            value: 0n,
          },
        ],
      })

      // Verify encodeFunctionData was called with correct params
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: PermitAbi,
        functionName: 'permit',
        args: [
          permitDTO.funder,
          permitDTO.spender,
          permitDTO.value,
          permitDTO.deadline,
          27, // v from parseSignature mock
          '0x1234567890123456789012345678901234567890123456789012345678901234', // r from parseSignature mock
          '0x5678901234567890123456789012345678901234567890123456789012345678', // s from parseSignature mock
        ],
      })

      // Verify parseSignature was called with the signature
      expect(parseSignature).toHaveBeenCalledWith(permitDTO.signature)
    })

    it('should generate transaction data for multiple permits', () => {
      // Create test PermitDTOs
      const permitDTO1: PermitDTO = {
        chainID: 1,
        funder: '0x0000000000000000000000000000000000000001' as Hex,
        spender: '0x0000000000000000000000000000000000000002' as Hex,
        token: '0x0000000000000000000000000000000000000003' as Hex,
        signature: '0x1234567890abcdef' as Hex,
        deadline: 9999999999n,
        value: 1000n,
      }

      const permitDTO2: PermitDTO = {
        chainID: 1,
        funder: '0x0000000000000000000000000000000000000004' as Hex,
        spender: '0x0000000000000000000000000000000000000005' as Hex,
        token: '0x0000000000000000000000000000000000000006' as Hex,
        signature: '0xabcdef1234567890' as Hex,
        deadline: 8888888888n,
        value: 2000n,
      }

      // Call the processor method
      const result = PermitProcessor.generateTxs(permitDTO1, permitDTO2)

      // Verify the transaction objects are correctly formed
      expect(result).toEqual({
        response: [
          {
            to: permitDTO1.token,
            data: '0xEncoded_Permit_Data',
            value: 0n,
          },
          {
            to: permitDTO2.token,
            data: '0xEncoded_Permit_Data',
            value: 0n,
          },
        ],
      })

      // Verify encodeFunctionData was called twice with correct params
      expect(encodeFunctionData).toHaveBeenCalledTimes(2)
      expect(encodeFunctionData).toHaveBeenNthCalledWith(1, {
        abi: PermitAbi,
        functionName: 'permit',
        args: [
          permitDTO1.funder,
          permitDTO1.spender,
          permitDTO1.value,
          permitDTO1.deadline,
          27, // v from parseSignature mock
          '0x1234567890123456789012345678901234567890123456789012345678901234', // r from parseSignature mock
          '0x5678901234567890123456789012345678901234567890123456789012345678', // s from parseSignature mock
        ],
      })
      expect(encodeFunctionData).toHaveBeenNthCalledWith(2, {
        abi: PermitAbi,
        functionName: 'permit',
        args: [
          permitDTO2.funder,
          permitDTO2.spender,
          permitDTO2.value,
          permitDTO2.deadline,
          27, // v from parseSignature mock
          '0x1234567890123456789012345678901234567890123456789012345678901234', // r from parseSignature mock
          '0x5678901234567890123456789012345678901234567890123456789012345678', // s from parseSignature mock
        ],
      })

      // Verify parseSignature was called twice with the signatures
      expect(parseSignature).toHaveBeenCalledTimes(2)
      expect(parseSignature).toHaveBeenNthCalledWith(1, permitDTO1.signature)
      expect(parseSignature).toHaveBeenNthCalledWith(2, permitDTO2.signature)
    })

    it('should return an error when no permits are provided', () => {
      // Call the processor method with empty array
      const result = PermitProcessor.generateTxs()

      // Verify it returns the correct error
      expect(result).toEqual({
        error: EcoError.NoPermitsProvided,
      })

      // Verify encodeFunctionData was not called
      expect(encodeFunctionData).not.toHaveBeenCalled()
    })

    it('should return an error when permits are on different chains', () => {
      // Create test PermitDTOs with different chain IDs
      const permitDTO1: PermitDTO = {
        chainID: 1,
        funder: '0x0000000000000000000000000000000000000001' as Hex,
        spender: '0x0000000000000000000000000000000000000002' as Hex,
        token: '0x0000000000000000000000000000000000000003' as Hex,
        signature: '0x1234567890abcdef' as Hex,
        deadline: 9999999999n,
        value: 1000n,
      }

      const permitDTO2: PermitDTO = {
        chainID: 2, // Different chain ID
        funder: '0x0000000000000000000000000000000000000004' as Hex,
        spender: '0x0000000000000000000000000000000000000005' as Hex,
        token: '0x0000000000000000000000000000000000000006' as Hex,
        signature: '0xabcdef1234567890' as Hex,
        deadline: 8888888888n,
        value: 2000n,
      }

      // Call the processor method
      const result = PermitProcessor.generateTxs(permitDTO1, permitDTO2)

      // Verify it returns the correct error
      expect(result).toEqual({
        error: EcoError.AllPermitsMustBeOnSameChain,
      })

      // Verify encodeFunctionData was not called
      expect(encodeFunctionData).not.toHaveBeenCalled()
    })
  })

  describe('getPermitTx', () => {
    it('should create a transaction object with the correct values', () => {
      // Create a test PermitDTO
      const permitDTO: PermitDTO = {
        chainID: 1,
        funder: '0x0000000000000000000000000000000000000001' as Hex,
        spender: '0x0000000000000000000000000000000000000002' as Hex,
        token: '0x0000000000000000000000000000000000000003' as Hex,
        signature: '0x1234567890abcdef' as Hex,
        deadline: 9999999999n,
        value: 1000n,
      }

      // Call the main method which will internally call getPermitTx
      const result = PermitProcessor.generateTxs(permitDTO)

      // Verify the transaction object is correctly formed
      expect(result).toEqual({
        response: [
          {
            to: permitDTO.token,
            data: '0xEncoded_Permit_Data',
            value: 0n,
          },
        ],
      })

      // Verify parseSignature was called with the signature
      expect(parseSignature).toHaveBeenCalledWith(permitDTO.signature)

      // Verify encodeFunctionData was called with correct params
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: PermitAbi,
        functionName: 'permit',
        args: [
          permitDTO.funder,
          permitDTO.spender,
          permitDTO.value,
          permitDTO.deadline,
          27, // v from parseSignature mock
          '0x1234567890123456789012345678901234567890123456789012345678901234', // r from parseSignature mock
          '0x5678901234567890123456789012345678901234567890123456789012345678', // s from parseSignature mock
        ],
      })
    })
  })

  describe('validateParams', () => {
    it('should return an empty object when parameters are valid', () => {
      // Create a test PermitDTO
      const permitDTO: PermitDTO = {
        chainID: 1,
        funder: '0x0000000000000000000000000000000000000001' as Hex,
        spender: '0x0000000000000000000000000000000000000002' as Hex,
        token: '0x0000000000000000000000000000000000000003' as Hex,
        signature: '0x1234567890abcdef' as Hex,
        deadline: 9999999999n,
        value: 1000n,
      }

      // Call the processor method which will internally validate params
      const result = PermitProcessor.generateTxs(permitDTO)

      // Verify no error was returned
      expect(result.error).toBeUndefined()

      // Verify the transaction was generated
      expect(result.response).toBeDefined()
      expect(result.response?.length).toBe(1)
    })
  })
})
