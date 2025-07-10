import { publicActions } from 'viem'
import { adaptKernelWallet } from './wallet-adapter'

describe('adaptKernelWallet', () => {
  // Mock KernelAccountClient
  const mockKernelClient = {
    chain: { id: 1 },
    account: { address: '0x123' },
    transport: {},
    sendTransaction: jest.fn().mockImplementation(() => Promise.resolve('0xhash')),
    extend: jest.fn(),
  }

  // Mock extended client with publicActions
  const mockExtendedClient = {
    waitForTransactionReceipt: jest.fn().mockImplementation(() => Promise.resolve({ status: 1 })),
  }

  // Mock switchChain function
  const mockSwitchChainFn = jest.fn().mockImplementation(() => Promise.resolve(mockKernelClient))

  // Store the adapted wallet
  let adaptedWallet

  beforeEach(() => {
    jest.clearAllMocks()
    mockKernelClient.extend.mockReturnValue(mockExtendedClient)
    adaptedWallet = adaptKernelWallet(mockKernelClient as any, mockSwitchChainFn as any)
  })

  it('should correctly implement vmType as evm', () => {
    expect(adaptedWallet.vmType).toBe('evm')
  })

  it('should return the chain ID from the kernel client', async () => {
    const chainId = await adaptedWallet.getChainId()
    expect(chainId).toBe(1)
  })

  it('should return the account address from the kernel client', async () => {
    const address = await adaptedWallet.address()
    expect(address).toBe('0x123')
  })

  it('should throw an error when trying to sign a message', async () => {
    await expect(adaptedWallet.handleSignMessageStep({}, {})).rejects.toThrow(
      'Message signing not supported',
    )
  })

  it('should delegate transaction sending to the kernel client', async () => {
    const mockTransaction = {
      data: {
        from: '0x123',
        to: '0x456',
        data: '0x123',
        value: '100',
        gas: '1000',
        maxFeePerGas: '2000',
        maxPriorityFeePerGas: '500',
      },
    }

    const result = await adaptedWallet.handleSendTransactionStep(1, mockTransaction, {})

    expect(mockKernelClient.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '0x456',
        data: '0x123',
        value: BigInt(100),
        gas: BigInt(1000),
        maxFeePerGas: BigInt(2000),
        maxPriorityFeePerGas: BigInt(500),
      }),
    )
    expect(result).toBe('0xhash')
  })

  it('should handle transaction with missing gas parameters', async () => {
    const mockTransaction = {
      data: {
        from: '0x123',
        to: '0x456',
        data: '0x123',
        value: '100',
      },
    }

    await adaptedWallet.handleSendTransactionStep(1, mockTransaction, {})

    expect(mockKernelClient.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '0x456',
        data: '0x123',
        value: BigInt(100),
        gas: undefined,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      }),
    )
  })

  it('should delegate transaction confirmation to the extended client', async () => {
    const mockOnReplaced = jest.fn()
    const mockOnCancelled = jest.fn()

    const result = await adaptedWallet.handleConfirmTransactionStep(
      '0xhash',
      1,
      mockOnReplaced,
      mockOnCancelled,
    )

    expect(mockKernelClient.extend).toHaveBeenCalledWith(publicActions)
    expect(mockExtendedClient.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '0xhash',
        confirmations: 1,
        timeout: 60_000,
        onReplaced: expect.any(Function),
      }),
    )
    expect(result).toEqual({ status: 1 })
  })

  it('should handle transaction replacement', async () => {
    const mockOnReplaced = jest.fn()
    const mockOnCancelled = jest.fn()

    mockExtendedClient.waitForTransactionReceipt.mockImplementation(({ onReplaced }) => {
      onReplaced({
        reason: 'replaced',
        transaction: { hash: '0xnewhash' },
      })
      return Promise.resolve({ status: 1 })
    })

    await adaptedWallet.handleConfirmTransactionStep('0xhash', 1, mockOnReplaced, mockOnCancelled)

    expect(mockOnReplaced).toHaveBeenCalledWith('0xnewhash')
    expect(mockOnCancelled).not.toHaveBeenCalled()
  })

  it('should handle transaction cancellation', async () => {
    const mockOnReplaced = jest.fn()
    const mockOnCancelled = jest.fn()

    // Create a mock implementation that calls onReplaced then throws
    mockExtendedClient.waitForTransactionReceipt.mockImplementation(({ onReplaced }) => {
      // Call the onReplaced callback with a cancelled transaction
      onReplaced({
        reason: 'cancelled',
        transaction: { hash: '0xnewhash' },
      })

      // Just verify that onCancelled was called and we're not asserting against a local variable
      return new Promise((_, reject) => {
        // This promise will be in pending state forever
        // The adapter should throw in the onReplaced callback handler
      })
    })

    // Expect the function to throw an error
    await expect(
      adaptedWallet.handleConfirmTransactionStep('0xhash', 1, mockOnReplaced, mockOnCancelled),
    ).rejects.toThrow('Transaction cancelled')

    // Verify callbacks
    expect(mockOnReplaced).not.toHaveBeenCalled()
    expect(mockOnCancelled).toHaveBeenCalled()
  })

  it('should switch chains when different chainId is used for confirmation', async () => {
    const newChainId = 2
    const mockReceipt = { status: 1 }
    const mockOnReplaced = jest.fn()
    const mockOnCancelled = jest.fn()

    // Mock a different client for new chain
    const newChainClient = {
      chain: { id: newChainId },
      extend: jest.fn().mockReturnValue({
        waitForTransactionReceipt: jest.fn().mockReturnValue(Promise.resolve(mockReceipt)),
      }),
    }

    mockSwitchChainFn.mockReturnValueOnce(Promise.resolve(newChainClient))

    await adaptedWallet.handleConfirmTransactionStep(
      '0xhash',
      newChainId,
      mockOnReplaced,
      mockOnCancelled,
    )

    expect(mockSwitchChainFn).toHaveBeenCalledWith(newChainId)
  })

  it('should use the provided switchChain function', async () => {
    await adaptedWallet.switchChain(42)
    expect(mockSwitchChainFn).toHaveBeenCalledWith(42)
  })

  it('should not support atomic batch transactions', async () => {
    const result = await adaptedWallet.supportsAtomicBatch(1)
    expect(result).toBe(false)
  })
})
