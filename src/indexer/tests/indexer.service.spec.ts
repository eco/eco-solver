import { Test, TestingModule } from '@nestjs/testing'
import { IndexerService } from '@/indexer/services/indexer.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { createMock } from '@golevelup/ts-jest'
import { Logger } from '@nestjs/common'

describe('IndexerService', () => {
  let service: IndexerService
  let ecoConfigService: EcoConfigService
  let mockFetch: jest.Mock

  const mockConfig = {
    url: 'https://mock-indexer.eco.com',
  }

  beforeEach(async () => {
    ecoConfigService = createMock<EcoConfigService>({
      getIndexer: jest.fn().mockReturnValue(mockConfig),
    })

    // Mock the global fetch function
    mockFetch = jest.fn()
    global.fetch = mockFetch

    const module: TestingModule = await Test.createTestingModule({
      providers: [IndexerService, { provide: EcoConfigService, useValue: ecoConfigService }],
    }).compile()

    // Mock Logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})

    service = module.get<IndexerService>(IndexerService)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getNextBatchWithdrawals', () => {
    const mockResponse = [
      {
        intent: {
          hash: '0xf3c75576957b491eb5941995156833bc57c7d6f101c7f4e2ec85dca851c2540e',
          creator: '0x256B70644f5D77bc8e2bb82C731Ddf747ecb1471',
          deadline: '123456',
          source: '1',
          destination: '10',
          rewardTokens: [{ token: '0x0000000000000000000000000000000000000001', amount: '1000' }],
          routeTokens: [{ token: '0x0000000000000000000000000000000000000002', amount: '2000' }],
          calls: [{ target: '0x0000000000000000000000000000000000000003', data: '0xdata', value: '0' }],
          salt: '0xf3c75576957b491eb5941995156833bc57c7d6f101c7f4e2ec85dca851c25401',
          inbox: '0x0000000000000000000000000000000000000004',
          prover: '0x0000000000000000000000000000000000000005',
          nativeValue: '1000000',
        },
      },
    ]

    it('should call the indexer API with the correct URL', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      })

      await service.getNextBatchWithdrawals('0xintentSource')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://mock-indexer.eco.com/intents/nextBatchWithdrawals?evt_log_address=0xintentSource',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('should return the API response data', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await service.getNextBatchWithdrawals('0xintentSource')

      expect(result).toEqual(mockResponse)
    })

    it('should handle errors during fetch', async () => {
      const error = new Error('Network error')
      mockFetch.mockRejectedValueOnce(error)

      await expect(service.getNextBatchWithdrawals('0xintentSource')).rejects.toThrow(error)
    })
  })

  describe('getNextSendBatch', () => {
    const mockResponse = [
      {
        hash: '0x123',
        prover: '0xprover',
        chainId: 1,
        destinationChainId: 10,
      },
    ]

    it('should call the indexer API with the correct URL', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      })

      await service.getNextSendBatch('0xintentSource')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://mock-indexer.eco.com/intents/nextBatch?evt_log_address=0xintentSource',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('should return the API response data', async () => {
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await service.getNextSendBatch('0xintentSource')

      expect(result).toEqual(mockResponse)
    })

    it('should handle errors during fetch', async () => {
      const error = new Error('Network error')
      mockFetch.mockRejectedValueOnce(error)

      await expect(service.getNextSendBatch('0xintentSource')).rejects.toThrow(error)
    })
  })

  describe('fetch', () => {
    it('should correctly build URL with search params', async () => {
      const mockData = { data: 'test-data' }
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockData),
      })

      await (service as any).fetch('/test-endpoint', {
        searchParams: { param1: 'value1', param2: 'value2', emptyParam: undefined },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://mock-indexer.eco.com/test-endpoint?param1=value1&param2=value2',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('should pass additional fetch options', async () => {
      const mockData = { data: 'test-data' }
      mockFetch.mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce(mockData),
      })

      await (service as any).fetch('/test-endpoint', {
        headers: { 'Content-Type': 'application/json' },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://mock-indexer.eco.com/test-endpoint',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
  })
})
