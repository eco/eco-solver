import { DeepMocked, createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { AwsConfigService } from '@/eco-configs/aws-config.service'

// This test file adds coverage for the new config getters added in the carlos/withdrawals branch

describe('EcoConfigService - New Getters', () => {
  let ecoConfigService: EcoConfigService
  let awsConfigService: DeepMocked<AwsConfigService>
  
  // Define sample configs to return
  const mockIndexerConfig = {
    url: 'https://mock-indexer.eco.com',
  }
  
  const mockWithdrawsConfig = {
    chunkSize: 20,
    intervalDuration: 360000,
  }
  
  const mockSendBatchConfig = {
    chunkSize: 200,
    intervalDuration: 360000,
    defaultGasPerIntent: 25000,
  }
  
  const mockHyperlaneConfig = {
    useHyperlaneDefaultHook: true,
    mappings: {
      '1': {
        mailbox: '0xmailbox1',
        aggregationHook: '0xaggregation1',
        hyperlaneAggregationHook: '0xhyperaggregation1',
      },
      '10': {
        mailbox: '0xmailbox10',
        aggregationHook: '0xaggregation10', 
        hyperlaneAggregationHook: '0xhyperaggregation10',
      },
    },
  }

  beforeEach(async () => {
    awsConfigService = createMock<AwsConfigService>()
    
    const configMod: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EcoConfigService,
          useFactory: async (awsConfigService: AwsConfigService) => {
            await awsConfigService.initConfigs()
            return new EcoConfigService([awsConfigService])
          },
          inject: [AwsConfigService],
        },
        { provide: AwsConfigService, useValue: awsConfigService },
      ],
    }).compile()

    ecoConfigService = configMod.get<EcoConfigService>(EcoConfigService)
    
    // Mock the get method to return our sample configs
    jest.spyOn(ecoConfigService, 'get').mockImplementation((key: string) => {
      switch (key) {
        case 'indexer':
          return mockIndexerConfig
        case 'withdraws':
          return mockWithdrawsConfig
        case 'sendBatch':
          return mockSendBatchConfig
        case 'hyperlane':
          return mockHyperlaneConfig
        default:
          return {}
      }
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getIndexer', () => {
    it('should return the indexer configuration', () => {
      const result = ecoConfigService.getIndexer()
      expect(result).toEqual(mockIndexerConfig)
      expect(ecoConfigService.get).toHaveBeenCalledWith('indexer')
    })
  })

  describe('getWithdraws', () => {
    it('should return the withdraws configuration', () => {
      const result = ecoConfigService.getWithdraws()
      expect(result).toEqual(mockWithdrawsConfig)
      expect(ecoConfigService.get).toHaveBeenCalledWith('withdraws')
    })
  })

  describe('getSendBatch', () => {
    it('should return the sendBatch configuration', () => {
      const result = ecoConfigService.getSendBatch()
      expect(result).toEqual(mockSendBatchConfig)
      expect(ecoConfigService.get).toHaveBeenCalledWith('sendBatch')
    })
  })

  describe('getHyperlane', () => {
    it('should return the hyperlane configuration', () => {
      const result = ecoConfigService.getHyperlane()
      expect(result).toEqual(mockHyperlaneConfig)
      expect(ecoConfigService.get).toHaveBeenCalledWith('hyperlane')
    })
  })
})