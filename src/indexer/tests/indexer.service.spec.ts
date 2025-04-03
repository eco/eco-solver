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
      providers: [
        IndexerService,
        { provide: EcoConfigService, useValue: ecoConfigService },
      ],
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
          hash: '0x123',
          creator: '0xabc',
          deadline: '123456',
          source: '1',
          destination: '10',
          rewardTokens: [{ token: '0xtoken1', amount: '1000' }],
          routeTokens: [{ token: '0xtoken2', amount: '2000' }],
          calls: [{ target: '0xtarget', data: '0xdata', value: '0' }],
          salt: '0xsalt',
          inbox: '0xinbox',
          prover: '0xprover',
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