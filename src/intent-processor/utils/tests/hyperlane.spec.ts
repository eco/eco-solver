import {
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  Hex,
  PublicClient,
} from 'viem'
import * as Hyperlane from '@/intent-processor/utils/hyperlane'
import { HyperlaneConfig } from '@/eco-configs/eco-config.types'

// Mock viem functions
jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  encodeFunctionData: jest.fn().mockReturnValue('0xencoded_function' as Hex),
  encodeAbiParameters: jest.fn().mockReturnValue('0xencoded_abi_params' as Hex),
  encodePacked: jest.fn().mockReturnValue('0xencoded_packed' as Hex),
  pad: jest.fn().mockImplementation((v) => v),
}))

describe('Hyperlane Utilities', () => {
  // Mock PublicClient for testing
  const mockPublicClient: PublicClient = {
    estimateGas: jest.fn().mockResolvedValue(BigInt(100000)),
    readContract: jest.fn().mockResolvedValue(BigInt(2000)),
  } as unknown as PublicClient

  // Sample configuration for tests
  const sampleConfig: HyperlaneConfig = {
    useHyperlaneDefaultHook: true,
    chains: {
      '1': {
        mailbox: '0x1111111111111111111111111111111111111111' as Hex,
        aggregationHook: '0x2222222222222222222222222222222222222222' as Hex,
        hyperlaneAggregationHook: '0x3333333333333333333333333333333333333333' as Hex,
      },
      '10': {
        mailbox: '0x4444444444444444444444444444444444444444' as Hex,
        aggregationHook: '0x5555555555555555555555555555555555555555' as Hex,
        hyperlaneAggregationHook: '0x6666666666666666666666666666666666666666' as Hex,
      },
    },
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('estimateMessageGas', () => {
    it('should estimate gas for cross-chain messages', async () => {
      // Setup test parameters
      const mailboxAddr = '0x1111111111111111111111111111111111111111' as Hex
      const handlerAddr = '0x2222222222222222222222222222222222222222' as Hex
      const origin = 1
      const sender = '0x3333333333333333333333333333333333333333' as Hex
      const message = '0x4444444444444444444444444444444444444444444444444444444444444444' as Hex

      // Call the function
      const result = await Hyperlane.estimateMessageGas(
        mockPublicClient,
        mailboxAddr,
        handlerAddr,
        origin,
        sender,
        message
      )

      // Verify that estimateGas was called with the right parameters
      expect(mockPublicClient.estimateGas).toHaveBeenCalledWith({
        account: mailboxAddr,
        to: handlerAddr,
        data: expect.any(String),
      })

      // Verify that viem.encodeFunctionData was called with MessageRecipientAbi and the right args
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: expect.arrayContaining([expect.objectContaining({ name: 'handle' })]),
        args: [origin, sender, message],
      })

      // Verify that the result includes the gas calculation with the 21000 subtracted
      // and 10% buffer added: ((100000n - 21000n) * 110n) / 100n
      expect(result).toBe(BigInt(86900)) // (100000 - 21000) * 1.1
    })
  })

  describe('estimateFee', () => {
    it('should estimate fee for sending a message', async () => {
      // Setup test parameters
      const mailboxAddr = '0x1111111111111111111111111111111111111111' as Hex
      const destination = 10
      const recipient = '0x2222222222222222222222222222222222222222' as Hex
      const messageBody = '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex
      const metadata = '0x4444444444444444444444444444444444444444' as Hex
      const hook = '0x5555555555555555555555555555555555555555' as Hex

      // Call the function
      const result = await Hyperlane.estimateFee(
        mockPublicClient,
        mailboxAddr,
        destination,
        recipient,
        messageBody,
        metadata,
        hook
      )

      // Verify that readContract was called with the right parameters
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mailboxAddr,
        abi: expect.arrayContaining([expect.objectContaining({ name: 'quoteDispatch' })]),
        functionName: 'quoteDispatch',
        args: [destination, recipient, messageBody, metadata, hook],
      })

      // Verify that the result matches the mock return value
      expect(result).toBe(BigInt(2000))
    })
  })

  describe('getChainMetadata', () => {
    it('should return chain metadata for a valid chain ID', () => {
      // Get metadata for Ethereum (chain ID 1)
      const result = Hyperlane.getChainMetadata(sampleConfig, 1)

      // Verify the result matches the config
      expect(result).toEqual({
        mailbox: '0x1111111111111111111111111111111111111111',
        aggregationHook: '0x2222222222222222222222222222222222222222',
        hyperlaneAggregationHook: '0x3333333333333333333333333333333333333333',
      })
    })

    it('should throw an error for an invalid chain ID', () => {
      // Try to get metadata for an unsupported chain
      expect(() => Hyperlane.getChainMetadata(sampleConfig, 42161)).toThrow(
        'Hyperlane config not found for chain id 42161'
      )
    })
  })

  describe('getMessageData', () => {
    it('should encode claimant and hashes correctly', () => {
      // Setup test parameters
      const claimant = '0x1111111111111111111111111111111111111111' as Hex
      const hashes = [
        '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
        '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex,
      ]

      // Reset mock for this test
      jest.mocked(encodeAbiParameters).mockClear()

      // Call the function
      Hyperlane.getMessageData(claimant, hashes)

      // Verify that encodeAbiParameters was called with the right parameters
      expect(encodeAbiParameters).toHaveBeenCalledWith(
        [{ type: 'bytes32[]' }, { type: 'address[]' }],
        expect.arrayContaining([
          expect.arrayContaining([
            '0x2222222222222222222222222222222222222222222222222222222222222222',
            '0x3333333333333333333333333333333333333333333333333333333333333333',
          ]),
          expect.arrayContaining([
            '0x1111111111111111111111111111111111111111',
            '0x1111111111111111111111111111111111111111',
          ]),
        ])
      )
    })
  })

  describe('getMetadata', () => {
    it('should pack values correctly', () => {
      // Setup test parameters
      const value = BigInt(1000)
      const gasLimit = BigInt(200000)

      // Reset mock for this test
      jest.mocked(encodePacked).mockClear()

      // Call the function
      Hyperlane.getMetadata(value, gasLimit)

      // Verify that encodePacked was called with the right parameters
      expect(encodePacked).toHaveBeenCalledWith(
        ['uint16', 'uint256', 'uint256'],
        [1, value, gasLimit]
      )
    })
  })
})
