import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { BlockchainService } from '../blockchain.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { LiFiAssetCacheManager } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager'
import { mainnet, optimism, base } from 'viem/chains'
import { Hex } from 'viem'

describe('BlockchainService', () => {
  let blockchainService: BlockchainService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let balanceService: DeepMocked<BalanceService>
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>
  let lifiTokenCacheManager: DeepMocked<LiFiAssetCacheManager>

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        {
          provide: KernelAccountClientService,
          useValue: createMock<KernelAccountClientService>(),
        },
        {
          provide: LiFiAssetCacheManager,
          useValue: createMock<LiFiAssetCacheManager>(),
        },
      ],
    }).compile()

    blockchainService = mod.get(BlockchainService)
    ecoConfigService = mod.get(EcoConfigService)
    balanceService = mod.get(BalanceService)
    kernelAccountClientService = mod.get(KernelAccountClientService)
    lifiTokenCacheManager = mod.get(LiFiAssetCacheManager)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  describe('getSupportedChainsAndTokens', () => {
    const mockKernelAddress = '0x1234567890123456789012345678901234567890' as Hex

    beforeEach(() => {
      kernelAccountClientService.getClient = jest
        .fn()
        .mockImplementation(async (chainId: number) => {
          return {
            kernelAccount: {
              address: mockKernelAddress,
            },
          }
        })
    })

    it('should return chains with tokens and wallet information', async () => {
      const supportedChains = [BigInt(1), BigInt(10)]
      const supportedTokens = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          chainId: 1,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Hex,
          chainId: 10,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
      ]

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      lifiTokenCacheManager.getTokenInfo = jest
        .fn()
        .mockImplementation((chainId: number, address: string) => {
          if (chainId === 1 && address === supportedTokens[0].address) {
            return { decimals: 18, symbol: 'USDC' }
          }
          if (chainId === 10 && address === supportedTokens[1].address) {
            return { decimals: 6, symbol: 'USDT' }
          }
          return undefined
        })

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        chainId: 1,
        chainName: mainnet.name,
        chainType: 'EVM',
        wallets: [
          {
            type: 'kernel',
            address: mockKernelAddress,
          },
        ],
        tokens: [
          {
            address: supportedTokens[0].address,
            decimals: 18,
            symbol: 'USDC',
          },
        ],
      })
      expect(result[1]).toEqual({
        chainId: 10,
        chainName: optimism.name,
        chainType: 'EVM',
        wallets: [
          {
            type: 'kernel',
            address: mockKernelAddress,
          },
        ],
        tokens: [
          {
            address: supportedTokens[1].address,
            decimals: 6,
            symbol: 'USDT',
          },
        ],
      })
    })

    it('should filter out chains not found in viemChains', async () => {
      const supportedChains = [BigInt(1), BigInt(999999)] // 999999 doesn't exist in viemChains
      const supportedTokens = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          chainId: 1,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
      ]

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      lifiTokenCacheManager.getTokenInfo = jest.fn().mockReturnValue({
        decimals: 18,
        symbol: 'USDC',
      })

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(1)
      expect(result[0].chainId).toBe(1)
      expect(kernelAccountClientService.getClient).toHaveBeenCalledTimes(1)
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(1)
    })

    it('should use default values when token info is not available', async () => {
      const supportedChains = [BigInt(1)]
      const supportedTokens = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          chainId: 1,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
      ]

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      lifiTokenCacheManager.getTokenInfo = jest.fn().mockReturnValue(undefined)

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(1)
      expect(result[0].tokens).toEqual([
        {
          address: supportedTokens[0].address,
          decimals: 6,
          symbol: 'Unknown',
        },
      ])
    })

    it('should handle kernel address being undefined', async () => {
      const supportedChains = [BigInt(1)]
      const supportedTokens = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          chainId: 1,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
      ]

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      kernelAccountClientService.getClient = jest.fn().mockImplementation(async () => {
        return {
          kernelAccount: undefined,
        }
      })

      lifiTokenCacheManager.getTokenInfo = jest.fn().mockReturnValue({
        decimals: 18,
        symbol: 'USDC',
      })

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(1)
      expect(result[0].wallets).toEqual([
        {
          type: 'kernel',
          address: undefined,
        },
      ])
    })

    it('should filter tokens by chainId', async () => {
      const supportedChains = [BigInt(1), BigInt(8453)]
      const supportedTokens = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          chainId: 1,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Hex,
          chainId: 8453,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
        {
          address: '0x3333333333333333333333333333333333333333' as Hex,
          chainId: 1, // Another token on chain 1
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
      ]

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      lifiTokenCacheManager.getTokenInfo = jest
        .fn()
        .mockImplementation((chainId: number, address: string) => {
          return { decimals: 18, symbol: 'TOKEN' }
        })

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(2)
      expect(result[0].chainId).toBe(1)
      expect(result[0].tokens).toHaveLength(2)
      expect(result[0].tokens[0].address).toBe(supportedTokens[0].address)
      expect(result[0].tokens[1].address).toBe(supportedTokens[2].address)

      expect(result[1].chainId).toBe(8453)
      expect(result[1].tokens).toHaveLength(1)
      expect(result[1].tokens[0].address).toBe(supportedTokens[1].address)
    })

    it('should handle empty chains array', async () => {
      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue([])
      balanceService.getInboxTokens = jest.fn().mockReturnValue([])

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(0)
    })

    it('should handle empty tokens for a chain', async () => {
      const supportedChains = [BigInt(1)]
      const supportedTokens: never[] = []

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(1)
      expect(result[0].chainId).toBe(1)
      expect(result[0].tokens).toHaveLength(0)
    })

    it('should handle multiple tokens on the same chain', async () => {
      const supportedChains = [BigInt(1)]
      const supportedTokens = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          chainId: 1,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
        {
          address: '0x2222222222222222222222222222222222222222' as Hex,
          chainId: 1,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
        {
          address: '0x3333333333333333333333333333333333333333' as Hex,
          chainId: 1,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
      ]

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      lifiTokenCacheManager.getTokenInfo = jest
        .fn()
        .mockImplementation((chainId: number, address: string) => {
          const tokenMap: Record<string, { decimals: number; symbol: string }> = {
            [supportedTokens[0].address]: { decimals: 18, symbol: 'USDC' },
            [supportedTokens[1].address]: { decimals: 6, symbol: 'USDT' },
            [supportedTokens[2].address]: { decimals: 8, symbol: 'WBTC' },
          }
          return tokenMap[address]
        })

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(1)
      expect(result[0].tokens).toHaveLength(3)
      expect(result[0].tokens).toEqual([
        { address: supportedTokens[0].address, decimals: 18, symbol: 'USDC' },
        { address: supportedTokens[1].address, decimals: 6, symbol: 'USDT' },
        { address: supportedTokens[2].address, decimals: 8, symbol: 'WBTC' },
      ])
    })

    it('should call getClient for each supported chain', async () => {
      const supportedChains = [BigInt(1), BigInt(10), BigInt(8453)]
      const supportedTokens: never[] = []

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      await blockchainService.getSupportedChainsAndTokens()

      expect(kernelAccountClientService.getClient).toHaveBeenCalledTimes(3)
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(1)
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(10)
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(8453)
    })

    it('should correctly format chain with base chain (8453)', async () => {
      const supportedChains = [BigInt(8453)]
      const supportedTokens = [
        {
          address: '0x1111111111111111111111111111111111111111' as Hex,
          chainId: 8453,
          type: 'erc20' as const,
          minBalance: 1000n,
          targetBalance: 5000n,
        },
      ]

      ecoConfigService.getSupportedChains = jest.fn().mockReturnValue(supportedChains)
      balanceService.getInboxTokens = jest.fn().mockReturnValue(supportedTokens)

      lifiTokenCacheManager.getTokenInfo = jest.fn().mockReturnValue({
        decimals: 18,
        symbol: 'USDC',
      })

      const result = await blockchainService.getSupportedChainsAndTokens()

      expect(result).toHaveLength(1)
      expect(result[0].chainId).toBe(8453)
      expect(result[0].chainName).toBe(base.name)
      expect(result[0].chainType).toBe('EVM')
    })
  })
})
