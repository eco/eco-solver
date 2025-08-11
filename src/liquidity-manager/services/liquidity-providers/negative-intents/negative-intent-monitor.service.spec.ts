import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { Hex } from 'viem'
import { NegativeIntentMonitorService } from './negative-intent-monitor.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { IProverAbi } from '@eco-foundation/routes-ts'

describe('NegativeIntentMonitorService', () => {
  let service: NegativeIntentMonitorService
  let ecoConfigService: jest.Mocked<EcoConfigService>
  let publicClient: jest.Mocked<MultichainPublicClientService>
  let mockClient: any
  let mockUnwatch: jest.Mock

  // Set global test timeout
  jest.setTimeout(10000)

  beforeEach(async () => {
    mockUnwatch = jest.fn()
    mockClient = {
      waitForTransactionReceipt: jest.fn(),
      watchContractEvent: jest.fn().mockReturnValue(mockUnwatch),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NegativeIntentMonitorService,
        {
          provide: EcoConfigService,
          useValue: {
            getIntentSources: jest.fn(),
          },
        },
        {
          provide: MultichainPublicClientService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<NegativeIntentMonitorService>(NegativeIntentMonitorService)
    ecoConfigService = module.get(EcoConfigService)
    publicClient = module.get(MultichainPublicClientService)

    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('monitorNegativeIntent', () => {
    const intentHash = '0x1234' as Hex
    const sourceChainId = 1
    const destinationChainId = 137
    const balanceTransactionHash = '0x5678' as Hex
    const mockProverAddress = '0xprover' as Hex
    const mockIntentSource = {
      chainID: sourceChainId,
      sourceAddress: '0xintentSource' as Hex,
      provers: [mockProverAddress],
    }

    beforeEach(() => {
      publicClient.getClient.mockResolvedValue(mockClient)
      ecoConfigService.getIntentSources.mockReturnValue([mockIntentSource as any])
    })

    it('should successfully monitor a negative intent with transaction confirmation and event detection', async () => {
      jest.useFakeTimers()

      mockClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
      })

      mockClient.watchContractEvent.mockImplementation(({ onLogs }) => {
        // Use setImmediate to ensure the callback is called after the promise is created
        setImmediate(() => {
          onLogs([
            {
              blockNumber: 12346n,
              transactionHash: '0xevent123',
            },
          ])
        })
        return mockUnwatch
      })

      const promise = service.monitorNegativeIntent(
        intentHash,
        sourceChainId,
        destinationChainId,
        balanceTransactionHash,
      )

      // Run all pending timers
      await jest.runAllTimersAsync()

      await promise

      expect(mockClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: balanceTransactionHash,
      })
      expect(mockClient.watchContractEvent).toHaveBeenCalledWith({
        address: mockProverAddress,
        abi: IProverAbi,
        eventName: 'IntentProven',
        strict: true,
        args: {
          _hash: intentHash,
        },
        onLogs: expect.any(Function),
        onError: expect.any(Function),
      })
      expect(mockUnwatch).toHaveBeenCalled()

      jest.useRealTimers()
    })

    it('should throw error if rebalance transaction fails', async () => {
      mockClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'failure',
        blockNumber: 12345n,
      })

      await expect(
        service.monitorNegativeIntent(
          intentHash,
          sourceChainId,
          destinationChainId,
          balanceTransactionHash,
        ),
      ).rejects.toThrow('Balance transaction failed')
    })

    it('should throw error if no intent source found for chain', async () => {
      ecoConfigService.getIntentSources.mockReturnValue([])

      mockClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
      })

      await expect(
        service.monitorNegativeIntent(
          intentHash,
          sourceChainId,
          destinationChainId,
          balanceTransactionHash,
        ),
      ).rejects.toThrow(`No intent source found for chain ${sourceChainId}`)
    })

    it('should timeout if IntentProven event is not detected within timeout period', async () => {
      jest.useFakeTimers()

      mockClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
      })

      // Mock watchContractEvent to not call onLogs (simulating no event)
      mockClient.watchContractEvent.mockImplementation(() => {
        return mockUnwatch
      })

      const promise = service.monitorNegativeIntent(
        intentHash,
        sourceChainId,
        destinationChainId,
        balanceTransactionHash,
      )

      // Immediately catch the promise to prevent unhandled rejection
      const resultPromise = promise.catch((e) => e)

      // Advance timers past the timeout period
      await jest.advanceTimersByTimeAsync(300_001)

      const result = await resultPromise
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe('IntentProven event not detected after 300000ms')

      // Note: mockUnwatch won't be called in timeout case because the service doesn't call it
      jest.useRealTimers()
    })

    it('should handle watch error properly', async () => {
      jest.useFakeTimers()

      mockClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
      })

      const watchError = new Error('Watch error')
      mockClient.watchContractEvent.mockImplementation(({ onError }) => {
        setImmediate(() => {
          onError(watchError)
        })
        return mockUnwatch
      })

      const promise = service.monitorNegativeIntent(
        intentHash,
        sourceChainId,
        destinationChainId,
        balanceTransactionHash,
      )

      // Immediately catch the promise to prevent unhandled rejection
      const resultPromise = promise.catch((e) => e)

      await jest.runAllTimersAsync()

      const result = await resultPromise
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe('Watch error')

      expect(mockUnwatch).toHaveBeenCalled()
      jest.useRealTimers()
    })

    it('should skip waiting for transaction if no transaction hash provided', async () => {
      jest.useFakeTimers()

      mockClient.watchContractEvent.mockImplementation(({ onLogs }) => {
        setImmediate(() => {
          onLogs([
            {
              blockNumber: 12346n,
              transactionHash: '0xevent123',
            },
          ])
        })
        return mockUnwatch
      })

      const promise = service.monitorNegativeIntent(
        intentHash,
        sourceChainId,
        destinationChainId,
        undefined as any,
      )

      await jest.runAllTimersAsync()
      await promise

      expect(mockClient.waitForTransactionReceipt).not.toHaveBeenCalled()
      expect(mockClient.watchContractEvent).toHaveBeenCalled()
      jest.useRealTimers()
    })

    it('should handle transaction receipt error', async () => {
      const receiptError = new Error('Receipt error')
      mockClient.waitForTransactionReceipt.mockRejectedValue(receiptError)

      await expect(
        service.monitorNegativeIntent(
          intentHash,
          sourceChainId,
          destinationChainId,
          balanceTransactionHash,
        ),
      ).rejects.toThrow('Receipt error')
    })
  })
})
