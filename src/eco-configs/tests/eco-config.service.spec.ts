const mockgetChainConfig = jest.fn()
import { DeepMocked, createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { EcoConfigService } from '../eco-config.service'
import { AwsConfigService } from '../aws-config.service'

jest.mock('../utils', () => {
  return {
    ...jest.requireActual('../utils'),
    getChainConfig: mockgetChainConfig,
  }
})

describe('Eco Config Helper Tests', () => {
  let ecoConfigService: EcoConfigService
  let awsConfigService: DeepMocked<AwsConfigService>
  let mockLog: jest.Mock
  const awsConfig = {
    aws: { faceAws: 'asdf', region: 'not-a-region' },
    rpcs: { keys: { '0x1234': '0x1234' } },
  }
  beforeEach(async () => {
    awsConfigService = createMock<AwsConfigService>()
    awsConfigService.getConfig = jest.fn().mockReturnValue(awsConfig)
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
    mockLog = jest.fn()
  })

  it.skip('should merge configs correctly', async () => {
    const oldConfig = ecoConfigService.get('aws') as any
    expect(ecoConfigService.get('aws')).toEqual({
      ...awsConfig.aws,
      ...oldConfig,
    })
  })

  describe('on getIntentSources', () => {
    const mockIS = {
      chainID: 1,
      tokens: ['0x12346817E7F6210A5B320f1a0bc96ffcF713A9B9'],
      provers: ['0xa03F9C231072E46Ba079C20CF987F7AFbe6CAcF4'],
    }
    const mockChainConfig = {
      IntentSource: 'source',
      HyperProver: '0x0000000000000000000000000000000000000000',
      MetaProver: '0x1111111111111111111111111111111111111111',
      Inbox: 'inbox',
    }

    beforeEach(() => {
      jest.spyOn(ecoConfigService, 'get').mockReturnValue([mockIS])
    })

    it('should throw if not a correct address', () => {
      ecoConfigService.get = jest.fn().mockReturnValue([
        {
          chainID: 1,
          tokens: ['not-an-address'],
        },
      ])
      expect(() => ecoConfigService.getIntentSources()).toThrow()
    })

    it("should throw if chain config doesn't have a chain for that source", () => {
      mockgetChainConfig.mockReturnValue(undefined)
      expect(() => ecoConfigService.getIntentSources()).toThrow()
      expect(mockgetChainConfig).toHaveBeenCalled()
    })

    it('should return the intent sources with default config (append)', () => {
      mockgetChainConfig.mockReturnValue(mockChainConfig)
      ecoConfigService.get = jest.fn().mockReturnValue([mockIS])
      const result = ecoConfigService.getIntentSources()
      expect(result).toEqual([
        {
          ...mockIS,
          sourceAddress: mockChainConfig.IntentSource,
          inbox: mockChainConfig.Inbox,
          provers: ['0xa03F9C231072E46Ba079C20CF987F7AFbe6CAcF4', mockChainConfig.MetaProver],
        },
      ])
      expect(mockgetChainConfig).toHaveBeenCalled()
      expect(mockgetChainConfig).toHaveBeenCalledWith(mockIS.chainID)
    })

    it('should append eco npm provers when config.ecoRoutes is "append"', () => {
      mockgetChainConfig.mockReturnValue(mockChainConfig)
      ecoConfigService.get = jest.fn().mockReturnValue([
        {
          ...mockIS,
          config: { ecoRoutes: 'append' },
        },
      ])
      const result = ecoConfigService.getIntentSources()
      expect(result).toEqual([
        {
          ...mockIS,
          sourceAddress: mockChainConfig.IntentSource,
          inbox: mockChainConfig.Inbox,
          provers: ['0xa03F9C231072E46Ba079C20CF987F7AFbe6CAcF4', mockChainConfig.MetaProver],
          config: { ecoRoutes: 'append' },
        },
      ])
      expect(mockgetChainConfig).toHaveBeenCalled()
    })

    it('should replace provers with eco npm provers when config.ecoRoutes is "replace"', () => {
      mockgetChainConfig.mockReturnValue(mockChainConfig)
      ecoConfigService.get = jest.fn().mockReturnValue([
        {
          ...mockIS,
          config: { ecoRoutes: 'replace' },
        },
      ])
      const result = ecoConfigService.getIntentSources()
      expect(result).toEqual([
        {
          ...mockIS,
          sourceAddress: mockChainConfig.IntentSource,
          inbox: mockChainConfig.Inbox,
          provers: [mockChainConfig.MetaProver],
          config: { ecoRoutes: 'replace' },
        },
      ])
      expect(mockgetChainConfig).toHaveBeenCalled()
    })

    it('should remove duplicate provers', () => {
      const customProver = mockChainConfig.MetaProver
      mockgetChainConfig.mockReturnValue({
        ...mockChainConfig,
        MetaProver: customProver, // Same as the one in mockIS.provers
      })
      const mockISWithCustomProver = {
        ...mockIS,
        provers: [customProver],
      }
      ecoConfigService.get = jest.fn().mockReturnValue([mockISWithCustomProver])
      const result = ecoConfigService.getIntentSources()

      // The result should have the provers deduped
      expect(result[0].provers).toHaveLength(1)
      expect(result[0].provers).toContain(customProver)
      expect(mockgetChainConfig).toHaveBeenCalled()
    })
  })

  describe('on getSolvers', () => {
    const mockSolver = {
      chainID: 1,
      targets: {
        '0x12346817e7F6210A5b320F1A0bC96FfCf713A9b9': '0x12346817e7F6210A5b320F1A0bC96FfCf713A9b9',
      },
    }
    const mockChainConfig = {
      Inbox: 'inbox',
    }

    beforeEach(() => {
      jest.spyOn(ecoConfigService, 'get').mockReturnValue({ 1: mockSolver })
    })

    it('should throw if not a correct address', () => {
      mockgetChainConfig.mockReturnValue(mockChainConfig)
      ecoConfigService.get = jest.fn().mockReturnValue([
        {
          ...mockSolver,
          targets: { adf: 'not-an-address' },
        },
      ])
      expect(() => ecoConfigService.getSolvers()).toThrow()
    })

    it("should throw if chain config doesn't have a chain for that solver", () => {
      mockgetChainConfig.mockReturnValue(undefined)
      expect(() => ecoConfigService.getSolvers()).toThrow()
      expect(mockgetChainConfig).toHaveBeenCalled()
    })

    it('should return the solvers', () => {
      mockgetChainConfig.mockReturnValue(mockChainConfig)
      ecoConfigService.get = jest.fn().mockReturnValue([mockSolver])
      const result = ecoConfigService.getSolvers()
      expect(result).toEqual([{ ...mockSolver, inboxAddress: mockChainConfig.Inbox }])
      expect(mockgetChainConfig).toHaveBeenCalled()
      expect(mockgetChainConfig).toHaveBeenCalledWith(mockSolver.chainID)
    })
  })

  describe('getRpcUrls', () => {
    const mockChain = { id: 1, name: 'test-chain' } as any
    const mockRpcConfig = {
      keys: { '1': 'key' },
      config: { webSockets: true },
      custom: {},
    }

    beforeEach(() => {
      // Mock the necessary config values
      jest.spyOn(ecoConfigService, 'getRpcConfig').mockReturnValue(mockRpcConfig as any)
      // Mock the ecoChains object and its getChain method
      const mockEcoChains = {
        getChain: jest.fn().mockReturnValue({
          rpcUrls: {
            default: {
              webSocket: ['ws://default-ws.com'],
              http: ['http://default-rpc.com'],
            },
            custom: {},
          },
        }),
        getRpcUrlsForChain: jest.fn().mockImplementation((_chainId, options) => {
          if (options?.isWebSocketEnabled === false) {
            return ['http://default-rpc.com']
          }
          return ['ws://default-ws.com', 'http://default-rpc.com']
        }),
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ecoConfigService.ecoChains = mockEcoChains
    })

    it('should return default websocket urls', () => {
      const { rpcUrls, config } = ecoConfigService.getRpcUrls(mockChain)
      expect(rpcUrls).toEqual(['ws://default-ws.com', 'http://default-rpc.com'])
    })

    it('should return default http urls when websockets are disabled', () => {
      jest
        .spyOn(ecoConfigService, 'getRpcConfig')
        .mockReturnValue({ ...mockRpcConfig, config: { webSockets: false } } as any)
      const { rpcUrls, config } = ecoConfigService.getRpcUrls(mockChain)
      expect(rpcUrls).toEqual(['http://default-rpc.com'])
    })

    it('should return custom rpc urls if available', () => {
      const customRpc = {
        http: ['http://custom-rpc.com'],
        webSocket: ['ws://custom-ws.com'],
      }
      jest.spyOn(ecoConfigService, 'getCustomRPCUrl').mockReturnValue(customRpc as any)

      const { rpcUrls, config } = ecoConfigService.getRpcUrls(mockChain)
      expect(rpcUrls).toEqual([
        'ws://custom-ws.com',
        'http://custom-rpc.com',
        'ws://default-ws.com',
        'http://default-rpc.com',
      ])
    })

    it('should prioritize custom http urls if websocket urls are not available in custom config', () => {
      const customRpc = {
        http: ['http://custom-rpc.com'],
      }
      jest.spyOn(ecoConfigService, 'getCustomRPCUrl').mockReturnValue(customRpc as any)

      const { rpcUrls, config } = ecoConfigService.getRpcUrls(mockChain)
      expect(rpcUrls).toEqual([
        'http://custom-rpc.com',
        'ws://default-ws.com',
        'http://default-rpc.com',
      ])
    })

    it('should pass through transport config from custom rpc config', () => {
      const customRpc = {
        http: ['http://custom-rpc.com'],
        config: { timeout: 5000 },
      }
      jest.spyOn(ecoConfigService, 'getCustomRPCUrl').mockReturnValue(customRpc as any)

      const { config } = ecoConfigService.getRpcUrls(mockChain)
      expect(config).toEqual(customRpc.config)
    })

    it('should throw an error if no rpc urls are found', () => {
      const mockEmptyEcoChains = {
        getChain: jest.fn().mockReturnValue({
          rpcUrls: {
            default: {}, // No default URLs
            custom: {},
          },
        }),
        getRpcUrlsForChain: jest.fn().mockReturnValue([]), // No default URLs
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ecoConfigService.ecoChains = mockEmptyEcoChains
      jest.spyOn(ecoConfigService, 'getCustomRPCUrl').mockReturnValue({} as any)
      jest
        .spyOn(ecoConfigService, 'getRpcConfig')
        .mockReturnValue({ ...mockRpcConfig, config: { webSockets: false } } as any)

      expect(() => ecoConfigService.getRpcUrls(mockChain)).toThrow(
        `Chain rpc not found for chain ${mockChain.id}`,
      )
    })
  })

  describe('getLiquidityManagerMaxQuoteSlippageBps', () => {
    it('should convert slippage to rounded basis points string', () => {
      jest
        .spyOn(ecoConfigService, 'getLiquidityManager')
        .mockReturnValue({ maxQuoteSlippage: 0.01234 } as any)

      expect(ecoConfigService.getLiquidityManagerMaxQuoteSlippageBps()).toBe('123')
    })

    it('should return 100 for 1% slippage', () => {
      jest
        .spyOn(ecoConfigService, 'getLiquidityManager')
        .mockReturnValue({ maxQuoteSlippage: 0.01 } as any)

      expect(ecoConfigService.getLiquidityManagerMaxQuoteSlippageBps()).toBe('100')
    })
  })
})
