import { Test, TestingModule } from '@nestjs/testing'
import { DeepMocked, createMock } from '@golevelup/ts-jest'
import { pad, parseUnits, getAbiItem, encodeEventTopics, keccak256 } from "viem"
import { Hex, toHex } from "viem"
import { TokenData } from '@eco-solver/liquidity-manager/types/types'
import { WarpRouteProviderService } from './warp-route-provider.service'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { BalanceService } from '@eco-solver/balance/balance.service'
import { LiFiProviderService } from '../LiFi/lifi-provider.service'
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'
import { WarpRoutesConfig } from '@eco-solver/eco-configs/eco-config.types'

const WALLET_ADDRESS: Hex = '0x21c77848520d8a41138287a5e9ed66185a4317f2'

const WARP_ROUTE_CONFIG: WarpRoutesConfig = {
  routes: [
    {
      chains: [
        {
          chainId: 1,
          token: '0x4200000000000000000000000000000000000042',
          warpContract: '0x4200000000000000000000000000000000000042',
          type: 'collateral',
        },
        {
          chainId: 2,
          token: '0x4200000000000000000000000000000000000042',
          warpContract: '0x4200000000000000000000000000000000000042',
          type: 'synthetic',
        },
      ],
    },
    {
      chains: [
        {
          chainId: 3,
          token: '0x4200000000000000000000000000000000000042',
          warpContract: '0x4200000000000000000000000000000000000042',
          type: 'collateral',
        },
        {
          chainId: 4,
          token: '0x4200000000000000000000000000000000000042',
          warpContract: '0x4200000000000000000000000000000000000042',
          type: 'synthetic',
        },
      ],
    },
  ],
}

describe('WarpRouteProviderService', () => {
  let service: WarpRouteProviderService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let balanceService: DeepMocked<BalanceService>
  let liFiProviderService: DeepMocked<LiFiProviderService>
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>

  beforeEach(async () => {
    const ecoConfigServiceMock = {
      getWarpRoutes: jest.fn().mockReturnValue(WARP_ROUTE_CONFIG),
      getHyperlane: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarpRouteProviderService,
        {
          provide: EcoConfigService,
          useValue: ecoConfigServiceMock,
        },
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: LiFiProviderService, useValue: createMock<LiFiProviderService>() },
        {
          provide: KernelAccountClientService,
          useValue: createMock<KernelAccountClientService>(),
        },
      ],
    }).compile()

    service = module.get<WarpRouteProviderService>(WarpRouteProviderService)
    ecoConfigService = module.get(EcoConfigService)
    balanceService = module.get(BalanceService)
    liFiProviderService = module.get(LiFiProviderService)
    kernelAccountClientService = module.get(KernelAccountClientService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getStrategy', () => {
    it('should return "WarpRoute"', () => {
      expect(service.getStrategy()).toEqual('WarpRoute')
    })
  })

  describe('getQuote', () => {
    it('should return a direct quote for a FULL action path (collateral to synthetic)', async () => {
      const tokenIn: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }
      const tokenOut: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }
      const swapAmount = 100

      const quotes = await service.getQuote(tokenIn, tokenOut, swapAmount)

      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('WarpRoute')
      expect(quotes[0].amountIn).toEqual(parseUnits(swapAmount.toString(), 18))
      expect(quotes[0].amountOut).toEqual(parseUnits(swapAmount.toString(), 18))
    })

    it('should return a direct quote for a FULL action path (synthetic to synthetic)', async () => {
      // Add a warp route with multiple synthetic tokens
      const multiSyntheticConfig: WarpRoutesConfig = {
        routes: [
          {
            chains: [
              {
                chainId: 1,
                token: '0x4200000000000000000000000000000000000042' as Hex,
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'collateral' as const,
              },
              {
                chainId: 2,
                token: '0x4200000000000000000000000000000000000042' as Hex,
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'synthetic' as const,
              },
              {
                chainId: 3,
                token: '0x4200000000000000000000000000000000000042' as Hex,
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'synthetic' as const,
              },
            ],
          },
        ],
      }
      ecoConfigService.getWarpRoutes.mockReturnValue(multiSyntheticConfig)

      const syntheticToken1: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }
      const syntheticToken2: TokenData = {
        chainId: 3,
        config: {
          chainId: 3,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }
      const swapAmount = 100

      const quotes = await service.getQuote(syntheticToken1, syntheticToken2, swapAmount)

      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('WarpRoute')
      expect(quotes[0].amountIn).toEqual(parseUnits(swapAmount.toString(), 18))
      expect(quotes[0].amountOut).toEqual(parseUnits(swapAmount.toString(), 18))
    })

    it('should throw an error when a collateral token is shared between multiple warp routes', async () => {
      // Create a config where the same collateral token is used in two different warp routes
      const sharedCollateralConfig: WarpRoutesConfig = {
        routes: [
          {
            chains: [
              {
                chainId: 1,
                token: '0x4200000000000000000000000000000000000042' as Hex,
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'collateral' as const,
              },
              {
                chainId: 2,
                token: '0x5200000000000000000000000000000000000052' as Hex,
                warpContract: '0x5200000000000000000000000000000000000052' as Hex,
                type: 'synthetic' as const,
              },
            ],
          },
          {
            chains: [
              {
                chainId: 1,
                token: '0x4200000000000000000000000000000000000042' as Hex, // Same collateral token
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'collateral' as const,
              },
              {
                chainId: 3,
                token: '0x6200000000000000000000000000000000000062' as Hex,
                warpContract: '0x6200000000000000000000000000000000000062' as Hex,
                type: 'synthetic' as const,
              },
            ],
          },
        ],
      }
      ecoConfigService.getWarpRoutes.mockReturnValue(sharedCollateralConfig)

      const syntheticToken1: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x5200000000000000000000000000000000000052',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x5200000000000000000000000000000000000052',
          decimals: 18,
          balance: 1000n,
        },
      }
      const syntheticToken2: TokenData = {
        chainId: 3,
        config: {
          chainId: 3,
          address: '0x6200000000000000000000000000000000000062',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x6200000000000000000000000000000000000062',
          decimals: 18,
          balance: 1000n,
        },
      }

      // Trying to transfer between synthetic tokens from different warp routes should fail
      await expect(service.getQuote(syntheticToken1, syntheticToken2, 100)).rejects.toThrow(
        'Unsupported action path',
      )
    })

    it('should use the correct warp route when collateral is shared between routes', async () => {
      // Create a config where the same collateral token is used in two different warp routes
      const sharedCollateralConfig: WarpRoutesConfig = {
        routes: [
          {
            chains: [
              {
                chainId: 1,
                token: '0x4200000000000000000000000000000000000042' as Hex, // Shared collateral
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'collateral' as const,
              },
              {
                chainId: 2,
                token: '0x5200000000000000000000000000000000000052' as Hex,
                warpContract: '0x5200000000000000000000000000000000000052' as Hex,
                type: 'synthetic' as const,
              },
            ],
          },
          {
            chains: [
              {
                chainId: 1,
                token: '0x4200000000000000000000000000000000000042' as Hex, // Same collateral
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'collateral' as const,
              },
              {
                chainId: 3,
                token: '0x6200000000000000000000000000000000000062' as Hex,
                warpContract: '0x6200000000000000000000000000000000000062' as Hex,
                type: 'synthetic' as const,
              },
            ],
          },
        ],
      }
      ecoConfigService.getWarpRoutes.mockReturnValue(sharedCollateralConfig)

      const sharedCollateralToken: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }
      const syntheticToken1: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x5200000000000000000000000000000000000052',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x5200000000000000000000000000000000000052',
          decimals: 18,
          balance: 1000n,
        },
      }

      // Should succeed when transferring between tokens in the same warp route
      const quotes = await service.getQuote(sharedCollateralToken, syntheticToken1, 100)
      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('WarpRoute')
      expect(quotes[0].amountIn).toEqual(parseUnits('100', 18))
      expect(quotes[0].amountOut).toEqual(parseUnits('100', 18))
    })

    it('should throw an error for transfers between different warp routes', async () => {
      const collateralToken1: TokenData = {
        chainId: 1,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 1,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }
      const collateralToken2: TokenData = {
        chainId: 3,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000043',
          chainId: 3,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000043',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      // Add a second warp route with collateral on chain 3
      const extendedConfig: WarpRoutesConfig = {
        routes: [
          ...WARP_ROUTE_CONFIG.routes,
          {
            chains: [
              {
                chainId: 3,
                token: '0x4200000000000000000000000000000000000043' as Hex,
                warpContract: '0x4200000000000000000000000000000000000043' as Hex,
                type: 'collateral' as const,
              },
              {
                chainId: 4,
                token: '0x4200000000000000000000000000000000000043' as Hex,
                warpContract: '0x4200000000000000000000000000000000000043' as Hex,
                type: 'synthetic' as const,
              },
            ],
          },
        ],
      }
      ecoConfigService.getWarpRoutes.mockReturnValue(extendedConfig)

      await expect(service.getQuote(collateralToken1, collateralToken2, 100)).rejects.toThrow(
        'Unsupported action path',
      )

      // Also test synthetic to synthetic between different warp routes
      const syntheticToken1: TokenData = {
        chainId: 2,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 2,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }
      const syntheticToken2: TokenData = {
        chainId: 4,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000043',
          chainId: 4,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000043',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      await expect(service.getQuote(syntheticToken1, syntheticToken2, 100)).rejects.toThrow(
        'Unsupported action path',
      )
    })

    it('should throw an error for collateral to collateral transfers in the same warp route', async () => {
      // Create a warp route with multiple collateral tokens
      const multiCollateralConfig: WarpRoutesConfig = {
        routes: [
          {
            chains: [
              {
                chainId: 1,
                token: '0x4200000000000000000000000000000000000042' as Hex,
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'collateral' as const,
              },
              {
                chainId: 2,
                token: '0x4200000000000000000000000000000000000042' as Hex,
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'synthetic' as const,
              },
              {
                chainId: 3,
                token: '0x4200000000000000000000000000000000000042' as Hex,
                warpContract: '0x4200000000000000000000000000000000000042' as Hex,
                type: 'collateral' as const,
              },
            ],
          },
        ],
      }
      ecoConfigService.getWarpRoutes.mockReturnValue(multiCollateralConfig)

      const collateralToken1: TokenData = {
        chainId: 1,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 1,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }
      const collateralToken3: TokenData = {
        chainId: 3,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 3,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      await expect(service.getQuote(collateralToken1, collateralToken3, 100)).rejects.toThrow(
        'Unsupported action path',
      )
    })

    it('should throw an error for an UNSUPPORTED action path', async () => {
      const tokenIn: TokenData = {
        chainId: 99,
        config: {
          chainId: 99,
          address: '0x1111111111111111111111111111111111111111',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x1111111111111111111111111111111111111111',
          decimals: 18,
          balance: 1000n,
        },
      }
      const tokenOut: TokenData = {
        chainId: 100,
        config: {
          chainId: 100,
          address: '0x2222222222222222222222222222222222222222',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x2222222222222222222222222222222222222222',
          decimals: 18,
          balance: 1000n,
        },
      }
      const swapAmount = 100

      await expect(service.getQuote(tokenIn, tokenOut, swapAmount)).rejects.toThrow(
        'Unsupported action path',
      )
    })

    it('should return only remote transfer when tokenOut is the collateral (synthetic -> collateral)', async () => {
      const syntheticTokenData: TokenData = {
        chainId: 2,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 2,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }
      const collateralTokenData: TokenData = {
        chainId: 1,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 1,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }
      const swapAmount = 100

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)
      balanceService.getAllTokenDataForAddress.mockResolvedValue([collateralTokenData])

      const quotes = await service.getQuote(syntheticTokenData, collateralTokenData, swapAmount)

      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('WarpRoute')
      expect(liFiProviderService.getQuote).not.toHaveBeenCalled()
    })

    it('should return only remote transfer when tokenOut is a synthetic (collateral -> synthetic)', async () => {
      const collateralTokenData: TokenData = {
        chainId: 1,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 1,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }
      const syntheticTokenData: TokenData = {
        chainId: 2,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 2,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }
      const swapAmount = 100

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)
      balanceService.getAllTokenDataForAddress.mockResolvedValue([syntheticTokenData])

      const quotes = await service.getQuote(collateralTokenData, syntheticTokenData, swapAmount)

      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('WarpRoute')
      expect(liFiProviderService.getQuote).not.toHaveBeenCalled()
    })

    it('should return partial quotes for a PARTIAL action path (synthetic -> collateral -> token)', async () => {
      const tokenIn: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }
      const tokenOut: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x5200000000000000000000000000000000000052',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x5200000000000000000000000000000000000052',
          decimals: 18,
          balance: 1000n,
        },
      }
      const collateralTokenData: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 500n,
        },
      }
      const swapAmount = 100

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)
      balanceService.getAllTokenDataForAddress.mockResolvedValue([collateralTokenData])
      liFiProviderService.getQuote.mockResolvedValue({
        strategy: 'lifi',
        context: { toAmountMin: '100' },
      } as any)

      const quotes = await service.getQuote(tokenIn, tokenOut, swapAmount)

      expect(quotes).toHaveLength(2)
      expect(quotes[0].strategy).toBe('WarpRoute')
      expect(quotes[1].strategy).toBe('lifi')
    })

    it('should return partial quotes for a PARTIAL action path (token -> collateral -> synthetic)', async () => {
      const tokenIn: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x5200000000000000000000000000000000000052',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x5200000000000000000000000000000000000052',
          decimals: 18,
          balance: 1000n,
        },
      }
      const tokenOut: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }
      const collateralTokenData: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 500n,
        },
      }
      const swapAmount = 100

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)
      balanceService.getAllTokenDataForAddress.mockResolvedValue([collateralTokenData])
      liFiProviderService.getQuote.mockResolvedValue({
        strategy: 'lifi',
        context: { toAmountMin: '100' },
      } as any)

      const quotes = await service.getQuote(tokenIn, tokenOut, swapAmount)

      expect(quotes).toHaveLength(2)
      expect(quotes[0].strategy).toBe('lifi')
      expect(quotes[1].strategy).toBe('WarpRoute')
    })

    it('should throw an error if no collateral is found for a partial quote', async () => {
      const tokenIn: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }
      const tokenOut: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x5200000000000000000000000000000000000052',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x5200000000000000000000000000000000000052',
          decimals: 18,
          balance: 1000n,
        },
      }
      const swapAmount = 100

      // Modify the config to not have a valid collateral for the partial path
      const brokenConfig = JSON.parse(JSON.stringify(WARP_ROUTE_CONFIG))
      brokenConfig.routes[0].chains = [brokenConfig.routes[0].chains[1]] // remove collateral

      ecoConfigService.getWarpRoutes.mockReturnValue(brokenConfig)
      balanceService.getAllTokenDataForAddress.mockResolvedValue([])

      await expect(service.getQuote(tokenIn, tokenOut, swapAmount)).rejects.toThrow(
        'Unable to get partial quote: No collateral found for input synthetic token',
      )
    })
  })

  describe('partial quotes with multiple tokens', () => {
    it('should select the best quote when multiple collateral tokens are available (TOKEN_TO_SYNTHETIC)', async () => {
      // Setup multiple collateral tokens with different output amounts
      const tokenIn: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x1111111111111111111111111111111111111111',
          decimals: 18,
          balance: 1000n,
        },
      }

      const syntheticTokenOut: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }

      // Setup a warp route with multiple collateral tokens
      const multiCollateralConfig: WarpRoutesConfig = {
        routes: [
          {
            chains: [
              {
                chainId: 1,
                token: '0x4200000000000000000000000000000000000042',
                warpContract: '0x4200000000000000000000000000000000000042',
                type: 'collateral',
              },
              {
                chainId: 3,
                token: '0x4200000000000000000000000000000000000043',
                warpContract: '0x4200000000000000000000000000000000000043',
                type: 'collateral',
              },
              {
                chainId: 2,
                token: '0x4200000000000000000000000000000000000042',
                warpContract: '0x4200000000000000000000000000000000000042',
                type: 'synthetic',
              },
            ],
          },
        ],
      }

      ecoConfigService.getWarpRoutes.mockReturnValue(multiCollateralConfig)

      const collateralToken1: TokenData = {
        chainId: 1,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 1,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      const collateralToken2: TokenData = {
        chainId: 3,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000043',
          chainId: 3,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000043',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)

      // Mock balance service to return the collateral tokens
      balanceService.getAllTokenDataForAddress
        .mockResolvedValueOnce([collateralToken1])
        .mockResolvedValueOnce([collateralToken2])

      // Mock LiFi quotes with different output amounts
      // First collateral has lower output
      liFiProviderService.getQuote
        .mockResolvedValueOnce({
          amountOut: parseUnits('80', 18),
          strategy: 'LiFi',
          context: {
            toAmountMin: '80000000000000000000', // 80 tokens
          },
        } as any)
        // Second collateral has higher output
        .mockResolvedValueOnce({
          amountOut: parseUnits('100', 18),
          strategy: 'LiFi',
          context: {
            toAmountMin: '100000000000000000000', // 100 tokens
          },
        } as any)

      const quotes = await service.getQuote(tokenIn, syntheticTokenOut, 100)

      expect(quotes).toHaveLength(2)
      expect(liFiProviderService.getQuote).toHaveBeenCalledTimes(2)

      // Should use the second collateral token (higher output)
      expect(quotes[0].strategy).toBe('LiFi')
      expect(quotes[0].amountOut).toBe(parseUnits('100', 18))
      expect(quotes[1].strategy).toBe('WarpRoute')
      expect(quotes[1].amountIn).toBe(parseUnits('100', 18))
    })

    it('should select the best quote when multiple synthetic tokens are available (TOKEN_TO_COLLATERAL)', async () => {
      const tokenIn: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x1111111111111111111111111111111111111111',
          decimals: 18,
          balance: 1000n,
        },
      }

      const collateralTokenOut: TokenData = {
        chainId: 3,
        config: {
          chainId: 3,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }

      // Setup a warp route with multiple synthetic tokens
      const multiSyntheticConfig: WarpRoutesConfig = {
        routes: [
          {
            chains: [
              {
                chainId: 3,
                token: '0x4200000000000000000000000000000000000042',
                warpContract: '0x4200000000000000000000000000000000000042',
                type: 'collateral',
              },
              {
                chainId: 2,
                token: '0x4200000000000000000000000000000000000043',
                warpContract: '0x4200000000000000000000000000000000000043',
                type: 'synthetic',
              },
              {
                chainId: 4,
                token: '0x4200000000000000000000000000000000000044',
                warpContract: '0x4200000000000000000000000000000000000044',
                type: 'synthetic',
              },
            ],
          },
        ],
      }

      ecoConfigService.getWarpRoutes.mockReturnValue(multiSyntheticConfig)

      const syntheticToken1: TokenData = {
        chainId: 2,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000043',
          chainId: 2,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000043',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      const syntheticToken2: TokenData = {
        chainId: 4,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000044',
          chainId: 4,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000044',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)

      balanceService.getAllTokenDataForAddress
        .mockResolvedValueOnce([syntheticToken1])
        .mockResolvedValueOnce([syntheticToken2])

      // First synthetic has lower output
      liFiProviderService.getQuote
        .mockResolvedValueOnce({
          amountOut: parseUnits('75', 18),
          strategy: 'LiFi',
          context: {
            toAmountMin: '75000000000000000000',
          },
        } as any)
        // Second synthetic has higher output
        .mockResolvedValueOnce({
          amountOut: parseUnits('95', 18),
          strategy: 'LiFi',
          context: {
            toAmountMin: '95000000000000000000',
          },
        } as any)

      const quotes = await service.getQuote(tokenIn, collateralTokenOut, 100)

      expect(quotes).toHaveLength(2)
      expect(liFiProviderService.getQuote).toHaveBeenCalledTimes(2)

      // Should use the second synthetic token (higher output)
      expect(quotes[0].strategy).toBe('LiFi')
      expect(quotes[0].amountOut).toBe(parseUnits('95', 18))
      expect(quotes[1].strategy).toBe('WarpRoute')
      expect(quotes[1].amountIn).toBe(parseUnits('95', 18))
    })

    it('should handle when no LiFi quotes are available for any candidate token', async () => {
      const tokenIn: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x1111111111111111111111111111111111111111',
          decimals: 18,
          balance: 1000n,
        },
      }

      const syntheticTokenOut: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)

      balanceService.getAllTokenDataForAddress.mockResolvedValue([])

      // Mock all LiFi quotes to fail
      liFiProviderService.getQuote.mockRejectedValue(new Error('No route found'))

      await expect(service.getQuote(tokenIn, syntheticTokenOut, 100)).rejects.toThrow(
        'No valid collateral chain found for token to synthetic path',
      )
    })

    it('should continue trying other tokens when one LiFi quote fails', async () => {
      const tokenIn: TokenData = {
        chainId: 1,
        config: {
          chainId: 1,
          address: '0x1111111111111111111111111111111111111111',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x1111111111111111111111111111111111111111',
          decimals: 18,
          balance: 1000n,
        },
      }

      const syntheticTokenOut: TokenData = {
        chainId: 2,
        config: {
          chainId: 2,
          address: '0x4200000000000000000000000000000000000042',
          type: 'erc20',
          minBalance: 0,
          targetBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          decimals: 18,
          balance: 1000n,
        },
      }

      // Setup a warp route with multiple collateral tokens
      const multiCollateralConfig: WarpRoutesConfig = {
        routes: [
          {
            chains: [
              {
                chainId: 1,
                token: '0x4200000000000000000000000000000000000042',
                warpContract: '0x4200000000000000000000000000000000000042',
                type: 'collateral',
              },
              {
                chainId: 3,
                token: '0x4200000000000000000000000000000000000043',
                warpContract: '0x4200000000000000000000000000000000000043',
                type: 'collateral',
              },
              {
                chainId: 2,
                token: '0x4200000000000000000000000000000000000042',
                warpContract: '0x4200000000000000000000000000000000000042',
                type: 'synthetic',
              },
            ],
          },
        ],
      }

      ecoConfigService.getWarpRoutes.mockReturnValue(multiCollateralConfig)

      const collateralToken1: TokenData = {
        chainId: 1,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000042',
          chainId: 1,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000042',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      const collateralToken2: TokenData = {
        chainId: 3,
        config: {
          type: 'erc20',
          address: '0x4200000000000000000000000000000000000043',
          chainId: 3,
          targetBalance: 0,
          minBalance: 0,
        },
        balance: {
          address: '0x4200000000000000000000000000000000000043',
          balance: parseUnits('1000', 18),
          decimals: 18,
        },
      }

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)

      balanceService.getAllTokenDataForAddress
        .mockResolvedValueOnce([collateralToken1])
        .mockResolvedValueOnce([collateralToken2])

      // First quote fails, second succeeds
      liFiProviderService.getQuote
        .mockRejectedValueOnce(new Error('No route found'))
        .mockResolvedValueOnce({
          amountOut: parseUnits('90', 18),
          strategy: 'LiFi',
          context: {
            toAmountMin: '90000000000000000000',
          },
        } as any)

      const quotes = await service.getQuote(tokenIn, syntheticTokenOut, 100)

      expect(quotes).toHaveLength(2)
      expect(liFiProviderService.getQuote).toHaveBeenCalledTimes(2)

      // Should use the second collateral token (only successful quote)
      expect(quotes[0].strategy).toBe('LiFi')
      expect(quotes[0].amountOut).toBe(parseUnits('90', 18))
    })
  })

  describe('execute', () => {
    it('should include an approval transaction when necessary', async () => {
      const collateralTokenAddress = '0x0000000000000000000000000000000000000001'
      const warpContractAddress = '0x4200000000000000000000000000000000000042'
      const quote = {
        tokenIn: {
          chainId: 1,
          config: {
            chainId: 1,
            address: collateralTokenAddress,
            type: 'erc20',
            minBalance: 0,
            targetBalance: 0,
          },
        },
        tokenOut: {
          config: {
            chainId: 2,
            address: '0x4200000000000000000000000000000000000042',
          },
        },
        amountOut: 100n,
        strategy: 'WarpRoute',
      }

      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
        readContract: jest.fn().mockResolvedValue(1n),
        execute: jest.fn().mockImplementation((txs) => {
          // Expect two transactions: approve and transferRemote
          expect(txs).toHaveLength(2)
          expect(txs[0].to).toBe(collateralTokenAddress) // approval
          expect(txs[1].to).toBe(warpContractAddress) // transfer
          return '0xtxhash'
        }),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({
          logs: [
            {
              data: '0x0000000000000000000000000000000000000000000000000000000000000000',
              topics: [keccak256(toHex('DispatchId(bytes32)')), pad('0xmessageId' as Hex)],
            },
          ],
        }),
        watchEvent: jest.fn().mockImplementation(({ onLogs }) => {
          onLogs('log')
          return () => {}
        }),
      }

      // Modify config so the input token is not the warp contract
      const configWithDifferentToken = JSON.parse(JSON.stringify(WARP_ROUTE_CONFIG))
      configWithDifferentToken.routes[0].chains[0].token = collateralTokenAddress
      configWithDifferentToken.routes[0].chains[0].warpContract = warpContractAddress
      ecoConfigService.getWarpRoutes.mockReturnValue(configWithDifferentToken)

      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)
      ecoConfigService.getHyperlane.mockReturnValue({
        chains: { '2': { mailbox: '0x0000000000000000000000000000000000000001' } },
      } as any)

      await service.execute(WALLET_ADDRESS, quote as any)
      expect(mockClient.execute).toHaveBeenCalled()
    })

    it('should throw an error if no DispatchId log is found', async () => {
      const quote = {
        tokenIn: {
          chainId: 1,
          config: {
            chainId: 1,
            address: '0x4200000000000000000000000000000000000042',
            type: 'erc20',
            minBalance: 0,
            targetBalance: 0,
          },
        },
        tokenOut: {
          config: {
            chainId: 2,
            address: '0x4200000000000000000000000000000000000042',
          },
        },
        amountOut: 100n,
        strategy: 'WarpRoute',
      }
      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
        readContract: jest.fn().mockResolvedValue(1n),
        execute: jest.fn().mockResolvedValue('0xtxhash'),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({ logs: [] }), // No logs
        watchEvent: jest.fn(),
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)

      await expect(service.execute(WALLET_ADDRESS, quote as any)).rejects.toThrow(
        'No message dispatched in transaction',
      )
    })

    it('should throw an error for an unsupported wallet', async () => {
      const quote = {
        tokenIn: {
          chainId: 1,
          config: {
            address: '0x4200000000000000000000000000000000000042',
            chainId: 1,
          },
        },
        tokenOut: {
          config: {
            address: '0x4200000000000000000000000000000000000042',
            chainId: 2,
          },
        },
      }
      const mockClient = {
        kernelAccountAddress: '0x4200000000000000000000000000000000000042', // Different address
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)

      await expect(service.execute(WALLET_ADDRESS, quote as any)).rejects.toThrow(
        `Wallet ${WALLET_ADDRESS} is not supported for WarpRoute execution`,
      )
    })

    it('should execute a quote and return a transaction hash', async () => {
      const quote = {
        tokenIn: {
          chainId: 1,
          config: {
            chainId: 1,
            address: '0x4200000000000000000000000000000000000042',
            type: 'erc20',
            minBalance: 0,
            targetBalance: 0,
          },
        },
        tokenOut: {
          config: {
            chainId: 2,
            address: '0x4200000000000000000000000000000000000042',
          },
        },
        amountOut: 100n,
        strategy: 'WarpRoute',
      }
      const mockClient = {
        kernelAccountAddress: WALLET_ADDRESS,
        readContract: jest.fn().mockResolvedValue(1n),
        execute: jest.fn().mockResolvedValue('0xtxhash'),
        waitForTransactionReceipt: jest.fn().mockResolvedValue({
          logs: [
            {
              data: '0x0000000000000000000000000000000000000000000000000000000000000000',
              topics: [keccak256(toHex('DispatchId(bytes32)')), pad('0xmessageId' as Hex)],
            },
          ],
        }),
        watchEvent: jest.fn().mockImplementation(({ onLogs }) => {
          onLogs('log')
          return () => {}
        }),
      }
      kernelAccountClientService.getClient.mockResolvedValue(mockClient as any)
      ecoConfigService.getHyperlane.mockReturnValue({
        chains: { '2': { mailbox: '0x0000000000000000000000000000000000000001' } },
      } as any)

      const txHash = await service.execute(WALLET_ADDRESS, quote as any)
      expect(txHash).toBe('0xtxhash')
      expect(mockClient.execute).toHaveBeenCalled()
    })
  })
})
