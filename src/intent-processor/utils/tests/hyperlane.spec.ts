import { encodeAbiParameters, Hex, PublicClient } from 'viem'
import { createMock } from '@golevelup/ts-jest'
import { HyperlaneMailboxAbi } from '@/contracts/HyperlaneMailbox'
import { HyperlaneConfig } from '@/eco-configs/eco-config.types'
import * as Hyperlane from '@/intent-processor/utils/hyperlane'

describe('Hyperlane Utils', () => {
  let publicClient: PublicClient
  let mailboxAddr: Hex
  let handlerAddr: Hex
  let mockHyperlaneConfig: HyperlaneConfig

  beforeEach(() => {
    publicClient = createMock<PublicClient>()
    mailboxAddr = '0x1234567890123456789012345678901234567890' as Hex
    handlerAddr = '0x2345678901234567890123456789012345678901' as Hex

    mockHyperlaneConfig = {
      chains: {
        '1': {
          mailbox: '0xMailbox1' as Hex,
          aggregationHook: '0xHook1' as Hex,
          hyperlaneAggregationHook: '0xHyperHook1' as Hex,
        },
        '2': {
          mailbox: '0xMailbox2' as Hex,
          aggregationHook: '0xHook2' as Hex,
          hyperlaneAggregationHook: '0xHyperHook2' as Hex,
        },
      },
      useHyperlaneDefaultHook: false,
    }
  })

  describe('estimateMessageGas', () => {
    it('should calculate gas correctly with buffer', async () => {
      const origin = 1
      const sender = '0x3456789012345678901234567890123456789012' as Hex
      const message = '0x1234' as Hex

      // Mock estimateGas response
      const estimatedGas = 121000n
      publicClient.estimateGas = jest.fn().mockResolvedValue(estimatedGas)

      const result = await Hyperlane.estimateMessageGas(
        publicClient,
        mailboxAddr,
        handlerAddr,
        origin,
        sender,
        message,
      )

      // Transaction initiation gas is 21_000, so:
      // (estimatedGas - 21_000) * 110% / 100
      const expected = ((estimatedGas - 21_000n) * 110n) / 100n

      expect(publicClient.estimateGas).toHaveBeenCalledWith({
        account: mailboxAddr,
        to: handlerAddr,
        data: expect.any(String),
      })
      expect(result).toEqual(expected)
    })
  })

  describe('estimateFee', () => {
    it('should call quoteDispatch with correct parameters', async () => {
      const destination = 2
      const recipient = '0x3456789012345678901234567890123456789012' as Hex
      const messageBody = '0x1234' as Hex
      const metadata = '0x5678' as Hex
      const hook = '0x9012' as Hex
      const expectedFee = 50000n

      publicClient.readContract = jest.fn().mockResolvedValue(expectedFee)

      const result = await Hyperlane.estimateFee(
        publicClient,
        mailboxAddr,
        destination,
        recipient,
        messageBody,
        metadata,
        hook,
      )

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mailboxAddr,
        abi: HyperlaneMailboxAbi,
        functionName: 'quoteDispatch',
        args: [destination, expect.any(String), messageBody, metadata, hook],
      })
      expect(result).toBe(expectedFee)
    })
  })

  describe('getChainMetadata', () => {
    it('should return correct chain metadata for valid chain id', () => {
      const chainId = 1
      const result = Hyperlane.getChainMetadata(mockHyperlaneConfig, chainId)

      expect(result).toEqual(mockHyperlaneConfig.chains['1'])
    })

    it('should throw error for invalid chain id', () => {
      const chainId = 99
      expect(() => Hyperlane.getChainMetadata(mockHyperlaneConfig, chainId)).toThrow(
        'Hyperlane config not found for chain id 99',
      )
    })
  })

  describe('getMessageData', () => {
    it('should encode claimant and hashes correctly', () => {
      const claimant = '0x3456789012345678901234567890123456789012' as Hex
      const hashes = [
        '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
      ]

      // Mock the encodeAbiParameters function
      jest.spyOn(require('viem'), 'encodeAbiParameters').mockImplementation(() => '0xEncodedResult')

      const result = Hyperlane.getMessageData(claimant, hashes)

      expect(encodeAbiParameters).toHaveBeenCalledWith(
        [{ type: 'bytes32[]' }, { type: 'address[]' }],
        [hashes, new Array(hashes.length).fill(claimant)],
      )
      expect(result).toBe('0xEncodedResult')
    })
  })

  describe('getMetadata', () => {
    it('should encode metadata correctly', () => {
      const value = 1000n
      const gasLimit = 200000n

      // Mock the encodePacked function
      const encodePacked = jest
        .spyOn(require('viem'), 'encodePacked')
        .mockImplementation(() => '0xEncodedMetadata')

      const result = Hyperlane.getMetadata(value, gasLimit)

      expect(encodePacked).toHaveBeenCalledWith(
        ['uint16', 'uint256', 'uint256'],
        [1, value, gasLimit],
      )
      expect(result).toBe('0xEncodedMetadata')
    })
  })
})
