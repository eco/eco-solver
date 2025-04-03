import { SimpleAccountActions } from '../simple-account.client'
import { encodeFunctionData, Hex } from 'viem'
import { SimpleAccountAbi } from '../../../../contracts'

// Mock the throwIfValueSendInBatch function
jest.mock('../../utils', () => ({
  throwIfValueSendInBatch: jest.fn()
}))

describe('SimpleAccountActions', () => {
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      sendTransaction: jest.fn().mockResolvedValue('0xtxhash' as Hex),
      simpleAccountAddress: '0xsimpleaccount' as Hex,
      chain: { id: 1 },
      account: { address: '0xsigner' }
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('execute', () => {
    it('should encode a single transaction and send it through the client', async () => {
      const actions = SimpleAccountActions(mockClient)
      
      const tx = {
        to: '0xrecipient' as Hex,
        data: '0xcalldata' as Hex,
        value: 100n
      }

      // Mock the encodeFunctionData
      const mockEncodedData = '0xencoded' as Hex
      jest.spyOn(require('viem'), 'encodeFunctionData').mockReturnValueOnce(mockEncodedData)

      const result = await actions.execute([tx])

      // Verify encodeFunctionData was called correctly
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: SimpleAccountAbi,
        functionName: 'execute',
        args: [tx.to, tx.value, tx.data]
      })

      // Verify sendTransaction was called with the encoded data
      expect(mockClient.sendTransaction).toHaveBeenCalledWith({
        data: mockEncodedData,
        kzg: undefined,
        to: mockClient.simpleAccountAddress,
        chain: mockClient.chain,
        account: mockClient.account
      })

      expect(result).toBe('0xtxhash')
    })

    it('should default value to 0n if not provided', async () => {
      const actions = SimpleAccountActions(mockClient)
      
      const tx = {
        to: '0xrecipient' as Hex,
        data: '0xcalldata' as Hex
        // value not provided
      }

      // Mock the encodeFunctionData
      const mockEncodedData = '0xencoded' as Hex
      jest.spyOn(require('viem'), 'encodeFunctionData').mockReturnValueOnce(mockEncodedData)

      await actions.execute([tx])

      // Verify value defaulted to 0n
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: SimpleAccountAbi,
        functionName: 'execute',
        args: [tx.to, 0n, tx.data]
      })
    })

    it('should encode multiple transactions as batch and send through the client', async () => {
      const actions = SimpleAccountActions(mockClient)
      
      const txs = [
        {
          to: '0xrecipient1' as Hex,
          data: '0xcalldata1' as Hex
        },
        {
          to: '0xrecipient2' as Hex,
          data: '0xcalldata2' as Hex
        }
      ]

      // Mock the throwIfValueSendInBatch function
      const throwIfValueSendInBatch = require('../../utils').throwIfValueSendInBatch

      // Mock the encodeFunctionData
      const mockEncodedData = '0xencodedbatch' as Hex
      jest.spyOn(require('viem'), 'encodeFunctionData').mockReturnValueOnce(mockEncodedData)

      const result = await actions.execute(txs)

      // Verify the check was called
      expect(throwIfValueSendInBatch).toHaveBeenCalledWith(txs)

      // Verify encodeFunctionData was called correctly for batch
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: SimpleAccountAbi,
        functionName: 'executeBatch',
        args: [
          txs.map(tx => tx.to), 
          txs.map(tx => tx.data)
        ]
      })

      // Verify sendTransaction was called with the encoded batch data
      expect(mockClient.sendTransaction).toHaveBeenCalledWith({
        data: mockEncodedData,
        kzg: undefined,
        to: mockClient.simpleAccountAddress,
        chain: mockClient.chain,
        account: mockClient.account
      })

      expect(result).toBe('0xtxhash')
    })
  })
})