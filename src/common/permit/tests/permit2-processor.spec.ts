import { Permit2Processor } from '@/common/permit/permit2-processor'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2TypedDataDetailsDTO } from '@/quote/dto/permit2/permit2-typed-data-details.dto'
import { encodeFunctionData, Hex } from 'viem'
import { Permit2Abi } from '@/contracts/Permit2.abi'

jest.mock('viem', () => {
  const originalModule = jest.requireActual('viem')
  return {
    ...originalModule,
    encodeFunctionData: jest.fn().mockImplementation((params) => {
      // Return mock encoded data based on function name
      if (params.functionName === 'permit') {
        return '0xEncoded_Permit_Data' as Hex
      }
      return '0xDefault_Encoded_Data' as Hex
    }),
  }
})

describe('Permit2Processor', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateTxs', () => {
    it('should generate transaction data for a single permit', () => {
      // Create a test Permit2DTO with a single detail
      const permit2DTO: Permit2DTO = {
        chainID: 1,
        permitContract: '0x1234567890123456789012345678901234567890' as Hex,
        details: [
          {
            token: '0x0000000000000000000000000000000000000001' as Hex,
            amount: 1000n,
            expiration: '9999999999',
            nonce: '1',
          },
        ],
        funder: '0x0000000000000000000000000000000000000003' as Hex,
        spender: '0x0000000000000000000000000000000000000002' as Hex,
        sigDeadline: 9999999999n,
        signature: '0x1234567890' as Hex,
      }

      // Call the processor method
      const result = Permit2Processor.generateTxs(permit2DTO)

      // Verify the transaction object is correctly formed
      expect(result).toEqual({
        to: permit2DTO.permitContract,
        data: '0xEncoded_Permit_Data',
        value: 0n,
      })

      // Verify encodeFunctionData was called with correct params for single permit
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: Permit2Abi,
        functionName: 'permit',
        args: [
          permit2DTO.funder,
          {
            details: {
              token: permit2DTO.details[0].token,
              amount: BigInt(permit2DTO.details[0].amount),
              expiration: Number(permit2DTO.details[0].expiration),
              nonce: Number(permit2DTO.details[0].nonce),
            },
            spender: permit2DTO.spender,
            sigDeadline: permit2DTO.sigDeadline,
          },
          permit2DTO.signature,
        ],
      })
    })

    it('should generate transaction data for multiple permits', () => {
      // Create a test Permit2DTO with multiple details
      const permit2DTO: Permit2DTO = {
        chainID: 1,
        permitContract: '0x1234567890123456789012345678901234567890' as Hex,
        details: [
          {
            token: '0x0000000000000000000000000000000000000001' as Hex,
            amount: 1000n,
            expiration: '9999999999',
            nonce: '1',
          },
          {
            token: '0x0000000000000000000000000000000000000002' as Hex,
            amount: 2000n,
            expiration: '9999999999',
            nonce: '2',
          },
        ],
        funder: '0x0000000000000000000000000000000000000003' as Hex,
        spender: '0x0000000000000000000000000000000000000004' as Hex,
        sigDeadline: 9999999999n,
        signature: '0x1234567890' as Hex,
      }

      // Call the processor method
      const result = Permit2Processor.generateTxs(permit2DTO)

      // Verify the transaction object is correctly formed
      expect(result).toEqual({
        to: permit2DTO.permitContract,
        data: '0xEncoded_Permit_Data',
        value: 0n,
      })

      // Verify encodeFunctionData was called with correct params for batch permit
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: Permit2Abi,
        functionName: 'permit',
        args: [
          permit2DTO.funder,
          {
            details: [
              {
                token: permit2DTO.details[0].token,
                amount: BigInt(permit2DTO.details[0].amount),
                expiration: Number(permit2DTO.details[0].expiration),
                nonce: Number(permit2DTO.details[0].nonce),
              },
              {
                token: permit2DTO.details[1].token,
                amount: BigInt(permit2DTO.details[1].amount),
                expiration: Number(permit2DTO.details[1].expiration),
                nonce: Number(permit2DTO.details[1].nonce),
              },
            ],
            spender: permit2DTO.spender,
            sigDeadline: permit2DTO.sigDeadline,
          },
          permit2DTO.signature,
        ],
      })
    })
  })

  describe('encodeFunctionData', () => {
    // It's a private method but we can test it indirectly through the public method
    it('should call encodeFunctionData with proper args for single permit', () => {
      // Create test data
      const owner = '0x0000000000000000000000000000000000000003' as Hex
      const spender = '0x0000000000000000000000000000000000000004' as Hex
      const sigDeadline = 9999999999n
      const signature = '0x1234567890' as Hex
      const details: Permit2TypedDataDetailsDTO[] = [
        {
          token: '0x0000000000000000000000000000000000000001' as Hex,
          amount: 1000n,
          expiration: '9999999999',
          nonce: '1',
        },
      ]

      // Call generateTxs which will internally call encodeFunctionData
      Permit2Processor.generateTxs({
        chainID: 1,
        permitContract: '0x1234567890123456789012345678901234567890' as Hex,
        details,
        funder: owner,
        spender,
        sigDeadline,
        signature,
      })

      // Verify encodeFunctionData was called with single permit params
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: Permit2Abi,
        functionName: 'permit',
        args: [
          owner,
          {
            details: {
              token: details[0].token,
              amount: BigInt(details[0].amount),
              expiration: Number(details[0].expiration),
              nonce: Number(details[0].nonce),
            },
            spender,
            sigDeadline,
          },
          signature,
        ],
      })
    })

    it('should call encodeFunctionData with proper args for batch permit', () => {
      // Create test data with multiple details
      const owner = '0x0000000000000000000000000000000000000003' as Hex
      const spender = '0x0000000000000000000000000000000000000004' as Hex
      const sigDeadline = 9999999999n
      const signature = '0x1234567890' as Hex
      const details: Permit2TypedDataDetailsDTO[] = [
        {
          token: '0x0000000000000000000000000000000000000001' as Hex,
          amount: 1000n,
          expiration: '9999999999',
          nonce: '1',
        },
        {
          token: '0x0000000000000000000000000000000000000002' as Hex,
          amount: 2000n,
          expiration: '9999999999',
          nonce: '2',
        },
      ]

      // Call generateTxs which will internally call encodeFunctionData
      Permit2Processor.generateTxs({
        chainID: 1,
        permitContract: '0x1234567890123456789012345678901234567890' as Hex,
        details,
        funder: owner,
        spender,
        sigDeadline,
        signature,
      })

      // Verify encodeFunctionData was called with batch permit params
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: Permit2Abi,
        functionName: 'permit',
        args: [
          owner,
          {
            details: [
              {
                token: details[0].token,
                amount: BigInt(details[0].amount),
                expiration: Number(details[0].expiration),
                nonce: Number(details[0].nonce),
              },
              {
                token: details[1].token,
                amount: BigInt(details[1].amount),
                expiration: Number(details[1].expiration),
                nonce: Number(details[1].nonce),
              },
            ],
            spender,
            sigDeadline,
          },
          signature,
        ],
      })
    })
  })

  describe('buildPermitSingleArg', () => {
    // Testing through the public method
    it('should build correct single permit argument structure', () => {
      // Set up test data
      const spender = '0x0000000000000000000000000000000000000002' as Hex
      const sigDeadline = 9999999999n
      const details: Permit2TypedDataDetailsDTO = {
        token: '0x0000000000000000000000000000000000000001' as Hex,
        amount: 1000n,
        expiration: '9999999999',
        nonce: '1',
      }

      // Call the main method which will internally call buildPermitSingleArg
      Permit2Processor.generateTxs({
        chainID: 1,
        permitContract: '0x1234567890123456789012345678901234567890' as Hex,
        details: [details],
        funder: '0x0000000000000000000000000000000000000003' as Hex,
        spender,
        sigDeadline,
        signature: '0x1234567890' as Hex,
      })

      // Verify encodeFunctionData was called with correct args created by buildPermitSingleArg
      expect(encodeFunctionData).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [
            expect.any(String),
            {
              details: {
                token: details.token,
                amount: BigInt(details.amount),
                expiration: Number(details.expiration),
                nonce: Number(details.nonce),
              },
              spender,
              sigDeadline,
            },
            expect.any(String),
          ],
        }),
      )
    })
  })

  describe('buildPermitBatchArg', () => {
    // Testing through the public method
    it('should build correct batch permit argument structure', () => {
      // Set up test data
      const spender = '0x0000000000000000000000000000000000000002' as Hex
      const sigDeadline = 9999999999n
      const details: Permit2TypedDataDetailsDTO[] = [
        {
          token: '0x0000000000000000000000000000000000000001' as Hex,
          amount: 1000n,
          expiration: '9999999999',
          nonce: '1',
        },
        {
          token: '0x0000000000000000000000000000000000000003' as Hex,
          amount: 3000n,
          expiration: '8888888888',
          nonce: '3',
        },
      ]

      // Call the main method which will internally call buildPermitBatchArg
      Permit2Processor.generateTxs({
        chainID: 1,
        permitContract: '0x1234567890123456789012345678901234567890' as Hex,
        details,
        funder: '0x0000000000000000000000000000000000000004' as Hex,
        spender,
        sigDeadline,
        signature: '0x1234567890' as Hex,
      })

      // Verify encodeFunctionData was called with correct args created by buildPermitBatchArg
      expect(encodeFunctionData).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [
            expect.any(String),
            {
              details: [
                {
                  token: details[0].token,
                  amount: BigInt(details[0].amount),
                  expiration: Number(details[0].expiration),
                  nonce: Number(details[0].nonce),
                },
                {
                  token: details[1].token,
                  amount: BigInt(details[1].amount),
                  expiration: Number(details[1].expiration),
                  nonce: Number(details[1].nonce),
                },
              ],
              spender,
              sigDeadline,
            },
            expect.any(String),
          ],
        }),
      )
    })
  })
})
