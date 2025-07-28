import { Test, TestingModule } from '@nestjs/testing'
import { CrowdLiquidityService } from '../crowd-liquidity.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { EcoAnalyticsService } from '@/analytics'
import { IntentSourceModel, IntentSourceStatus } from '../schemas/intent-source.schema'
import { CrowdLiquidityConfig } from '@/eco-configs/eco-config.types'
import { Hex, GetTransactionReceiptReturnType } from 'viem'
import { LIT_NETWORKS_KEYS } from '@lit-protocol/types'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

const MOCK_ADDR_1 = '0x1111111111111111111111111111111111111111' as Hex
const MOCK_ADDR_2 = '0x2222222222222222222222222222222222222222' as Hex
const MOCK_ADDR_3 = '0x3333333333333333333333333333333333333333' as Hex
const MOCK_ADDR_4 = '0x4444444444444444444444444444444444444444' as Hex
const MOCK_ADDR_5 = '0x5555555555555555555555555555555555555555' as Hex
const MOCK_ADDR_6 = '0x6666666666666666666666666666666666666666' as Hex
const MOCK_ADDR_7 = '0x7777777777777777777777777777777777777777' as Hex
const MOCK_ADDR_8 = '0x8888888888888888888888888888888888888888' as Hex
const MOCK_ADDR_9 = '0x9999999999999999999999999999999999999999' as Hex
const MOCK_ADDR_UNSUPPORTED = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' as Hex

describe('CrowdLiquidityService', () => {
  let service: CrowdLiquidityService
  let ecoConfigService: EcoConfigService

  const mockEcoConfigService = {
    getCrowdLiquidity: jest.fn(),
    getIntentSource: jest.fn(),
  }

  const mockBalanceService = {
    getInboxTokens: jest.fn(),
    getAllTokenDataForAddress: jest.fn(),
  }
  const mockEcoAnalytics = {
    trackCrowdLiquidityRewardCheck: jest.fn(),
    trackCrowdLiquidityRewardCheckResult: jest.fn(),
    trackCrowdLiquidityRouteSupportCheck: jest.fn(),
    trackCrowdLiquidityRouteSupportResult: jest.fn(),
    trackCrowdLiquidityPoolSolvencyResult: jest.fn(),
    trackCrowdLiquidityPoolSolvencyError: jest.fn(),
  }
  const mockWalletClientService = {
    getClient: jest.fn(),
  }
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrowdLiquidityService,
        { provide: EcoConfigService, useValue: mockEcoConfigService },
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: EcoAnalyticsService, useValue: mockEcoAnalytics },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: WalletClientDefaultSignerService, useValue: mockWalletClientService },
      ],
    }).compile()

    service = module.get<CrowdLiquidityService>(CrowdLiquidityService)
    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('isRewardEnough', () => {
    let baseConfig: CrowdLiquidityConfig
    let intentModel: IntentSourceModel

    beforeEach(() => {
      baseConfig = {
        minExcessFees: {
          1: '100',
        },
        litNetwork: 'cayenne' as LIT_NETWORKS_KEYS,
        capacityTokenOwnerPk: MOCK_ADDR_1,
        defaultTargetBalance: 1000,
        actions: {
          fulfill: 'fulfill-action',
          rebalance: 'rebalance-action',
        },
        pkp: {
          ethAddress: MOCK_ADDR_3,
          publicKey: '0x04...',
        },
        supportedTokens: [],
      }

      intentModel = {
        intent: {
          route: {
            destination: 1n,
            tokens: [{ token: MOCK_ADDR_4, amount: 10000n }],
            salt: MOCK_ADDR_5,
            source: 2n,
            inbox: MOCK_ADDR_6,
            calls: [],
          },
          reward: {
            tokens: [{ token: MOCK_ADDR_7, amount: 10200n }],
            creator: MOCK_ADDR_8,
            prover: MOCK_ADDR_9,
            deadline: 1234567890n,
            nativeValue: 0n,
          },
          hash: MOCK_ADDR_1,
          logIndex: 1,
        },
        status: 'PENDING' as IntentSourceStatus,
        receipt: {} as GetTransactionReceiptReturnType,
      } as IntentSourceModel
    })

    it('should return true when reward is sufficient', async () => {
      jest.spyOn(ecoConfigService, 'getCrowdLiquidity').mockReturnValue(baseConfig)
      service.onModuleInit()
      await expect(service.isRewardEnough(intentModel, 10000n, 100n)).resolves.toBe(true)
    })

    it('should return false when reward is not enough', async () => {
      jest.spyOn(ecoConfigService, 'getCrowdLiquidity').mockReturnValue(baseConfig)
      service.onModuleInit()
      await expect(service.isRewardEnough(intentModel, 10000n, 201n)).resolves.toBe(false)
    })
  })

  describe('isSupportedToken', () => {
    let baseConfig: CrowdLiquidityConfig

    beforeEach(() => {
      baseConfig = {
        minExcessFees: {
          1: '100',
        },
        litNetwork: 'cayenne' as LIT_NETWORKS_KEYS,
        capacityTokenOwnerPk: MOCK_ADDR_1,
        defaultTargetBalance: 1000,
        actions: {
          fulfill: 'fulfill-action',
          rebalance: 'rebalance-action',
        },
        pkp: {
          ethAddress: MOCK_ADDR_3,
          publicKey: '0x04...',
        },
        supportedTokens: [{ chainId: 1, tokenAddress: MOCK_ADDR_4 }],
      }
      jest.spyOn(ecoConfigService, 'getCrowdLiquidity').mockReturnValue(baseConfig)
      service.onModuleInit()
    })

    it('should return true if token is supported', () => {
      expect(service.isSupportedToken(1, MOCK_ADDR_4)).toBe(true)
    })

    it('should return false if token is not supported', () => {
      expect(service.isSupportedToken(1, MOCK_ADDR_UNSUPPORTED)).toBe(false)
    })

    it('should return false if chain is not supported', () => {
      expect(service.isSupportedToken(2, MOCK_ADDR_4)).toBe(false)
    })
  })

  describe('isRouteSupported', () => {
    let intentModel: IntentSourceModel
    let baseConfig: CrowdLiquidityConfig

    beforeEach(() => {
      baseConfig = {
        minExcessFees: {
          1: '100',
        },
        litNetwork: 'cayenne' as LIT_NETWORKS_KEYS,
        capacityTokenOwnerPk: MOCK_ADDR_1,
        defaultTargetBalance: 1000,
        actions: {
          fulfill: 'fulfill-action',
          rebalance: 'rebalance-action',
        },
        pkp: {
          ethAddress: MOCK_ADDR_3,
          publicKey: '0x04...',
        },
        supportedTokens: [
          { chainId: 1, tokenAddress: MOCK_ADDR_4 },
          { chainId: 2, tokenAddress: MOCK_ADDR_5 },
        ],
      }
      jest.spyOn(ecoConfigService, 'getCrowdLiquidity').mockReturnValue(baseConfig)
      service.onModuleInit()

      intentModel = {
        intent: {
          route: {
            source: 1n,
            destination: 2n,
            calls: [{ target: MOCK_ADDR_5, data: '0xa9059cbb' as Hex, value: 0n }],
            salt: MOCK_ADDR_6,
            inbox: MOCK_ADDR_7,
            tokens: [],
          },
          reward: {
            tokens: [{ token: MOCK_ADDR_4, amount: 1n }],
            creator: MOCK_ADDR_8,
            prover: MOCK_ADDR_9,
            deadline: 0n,
            nativeValue: 0n,
          },
          hash: MOCK_ADDR_1,
          logIndex: 0,
        },
        status: 'PENDING',
        receipt: {} as any,
      } as IntentSourceModel
    })

    it('should return true for a fully supported route', () => {
      expect(service.isRouteSupported(intentModel)).toBe(true)
    })

    it('should return false for an unsupported reward token', () => {
      intentModel.intent.reward.tokens = [{ token: MOCK_ADDR_UNSUPPORTED, amount: 1n }]
      expect(service.isRouteSupported(intentModel)).toBe(false)
    })

    it('should return false for an unsupported target token', () => {
      intentModel.intent.route.calls = [
        { target: MOCK_ADDR_UNSUPPORTED, data: '0xa9059cbb' as Hex, value: 0n },
      ]
      expect(service.isRouteSupported(intentModel)).toBe(false)
    })

    it('should return false for an unsupported action', () => {
      intentModel.intent.route.calls = [
        { target: MOCK_ADDR_5, data: '0xdeadbeef' as Hex, value: 0n },
      ]
      expect(service.isRouteSupported(intentModel)).toBe(false)
    })
  })

  describe('getSupportedTokens', () => {
    it('should return only supported tokens with their target balance', () => {
      const config = {
        supportedTokens: [{ chainId: 1, tokenAddress: MOCK_ADDR_1 }],
        defaultTargetBalance: 500,
      } as CrowdLiquidityConfig
      jest.spyOn(ecoConfigService, 'getCrowdLiquidity').mockReturnValue(config)

      const inboxTokens = [
        { chainId: 1, address: MOCK_ADDR_1, name: 'ABC', decimals: 18, symbol: 'ABC' },
        { chainId: 2, address: MOCK_ADDR_2, name: 'DEF', decimals: 18, symbol: 'DEF' },
      ]
      mockBalanceService.getInboxTokens.mockReturnValue(inboxTokens)

      service.onModuleInit()

      const supportedTokens = service.getSupportedTokens()
      expect(supportedTokens).toHaveLength(1)
      expect(supportedTokens[0]).toEqual({
        ...inboxTokens[0],
        targetBalance: 500,
      })
    })
  })

  describe('isPoolSolvent', () => {
    let intentModel: IntentSourceModel

    beforeEach(() => {
      const config = {
        supportedTokens: [{ chainId: 1, tokenAddress: MOCK_ADDR_1 }],
      } as CrowdLiquidityConfig
      jest.spyOn(ecoConfigService, 'getCrowdLiquidity').mockReturnValue(config)
      jest
        .spyOn(ecoConfigService, 'getIntentSource')
        .mockReturnValue({ stablePoolAddress: MOCK_ADDR_2 } as any)

      const inboxTokens = [
        { chainId: 1, address: MOCK_ADDR_1, name: 'ABC', decimals: 18, symbol: 'ABC' },
      ]
      mockBalanceService.getInboxTokens.mockReturnValue(inboxTokens)

      intentModel = {
        intent: {
          route: {
            destination: 1n,
            tokens: [{ token: MOCK_ADDR_1, amount: 100n }],
          },
        },
      } as any
    })

    it('should return true if pool has sufficient balance', async () => {
      const tokenData = [{ config: { address: MOCK_ADDR_1 }, balance: { balance: 150n } }]
      mockBalanceService.getAllTokenDataForAddress.mockResolvedValue(tokenData)
      service.onModuleInit()

      await expect(service.isPoolSolvent(intentModel)).resolves.toBe(true)
    })

    it('should return false if pool has insufficient balance', async () => {
      const tokenData = [{ config: { address: MOCK_ADDR_1 }, balance: { balance: 50n } }]
      mockBalanceService.getAllTokenDataForAddress.mockResolvedValue(tokenData)
      service.onModuleInit()

      await expect(service.isPoolSolvent(intentModel)).resolves.toBe(false)
    })
  })
})
