import { DeepMocked, createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { zeroAddress } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

describe('CheckBalancesCronJobManager', () => {
  let service: LiquidityManagerService
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>
  let crowdLiquidityService: DeepMocked<CrowdLiquidityService>
  let checkBalancesCronJobManager: CheckBalancesCronJobManager

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityManagerService,
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
        { provide: CrowdLiquidityService, useValue: createMock<CrowdLiquidityService>() },
      ],
    }).compile()

    service = module.get<LiquidityManagerService>(LiquidityManagerService)
    balanceService = module.get(BalanceService)
    ecoConfigService = module.get(EcoConfigService)
    kernelAccountClientService = module.get(KernelAccountClientService)
    crowdLiquidityService = module.get(CrowdLiquidityService)

    // Setup mocks
    crowdLiquidityService.getPoolAddress = jest.fn().mockResolvedValue(zeroAddress)
    kernelAccountClientService.getClient = jest
      .fn()
      .mockResolvedValue({ kernelAccount: { address: zeroAddress } })

    // Create job manager
    checkBalancesCronJobManager = new CheckBalancesCronJobManager('test')
  })

  describe('process', () => {
    it('should combine token rebalances and WETH rebalances', async () => {
      // Mock processor object
      const mockProcessor = {
        liquidityManagerService: service,
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      }

      // Mock token data
      const mockDeficitAnalysis = {
        items: [
          { 
            config: { address: '0xToken1' },
            analysis: { 
              diff: 100,
              balance: { current: 50n },
              targetSlippage: { min: 150n }
            }
          }
        ]
      }

      // Mock rebalance request for tokens
      const mockTokenRebalance = {
        token: { address: '0xToken1' },
        quotes: [{ amountIn: 100n, amountOut: 95n }]
      }

      // Mock WETH rebalance
      const mockWETHRebalance = {
        token: { address: '0xWETH' },
        quotes: [{ amountIn: 200n, amountOut: 195n }]
      }

      // Setup mocks
      jest.spyOn(service, 'analyzeTokens').mockResolvedValue({
        ...mockDeficitAnalysis,
        deficit: mockDeficitAnalysis,
        surplus: { items: [] }
      } as any)

      jest.spyOn(service, 'getOptimizedRebalancing').mockResolvedValue([mockTokenRebalance] as any)
      jest.spyOn(service, 'storeRebalancing').mockResolvedValue(undefined)
      jest.spyOn(service, 'getWETHRebalances').mockResolvedValue([mockWETHRebalance] as any)
      
      // Call process method
      await checkBalancesCronJobManager.process(mockProcessor as any)
      
      // Verify WETH rebalances were fetched
      expect(service.getWETHRebalances).toHaveBeenCalledWith(zeroAddress)
      
      // Verify rebalance job was added with combined rebalances
      const mockJobInfo = expect.objectContaining({
        name: expect.stringContaining('rebalance'),
        data: {
          rebalance: expect.objectContaining({
            walletAddress: zeroAddress,
            rebalances: [mockWETHRebalance, mockTokenRebalance]
          })
        }
      })
      
      // Should have logged about adding the job
      expect(mockProcessor.logger.info).toHaveBeenCalledWith(
        expect.any(EcoLogMessage),
        expect.objectContaining({ 
          jobInfo: mockJobInfo
        })
      )
    })

    it('should not add job when no rebalances are found', async () => {
      // Mock processor object
      const mockProcessor = {
        liquidityManagerService: service,
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      }

      // Setup mocks to return empty results
      jest.spyOn(service, 'analyzeTokens').mockResolvedValue({
        deficit: { items: [] },
        surplus: { items: [] },
        items: []
      } as any)
      
      jest.spyOn(service, 'getWETHRebalances').mockResolvedValue([])
      
      // Call process method
      await checkBalancesCronJobManager.process(mockProcessor as any)
      
      // Verify WETH rebalances were fetched
      expect(service.getWETHRebalances).toHaveBeenCalledWith(zeroAddress)
      
      // Should have logged a warning about no rebalances
      expect(mockProcessor.logger.warn).toHaveBeenCalledWith(
        expect.any(EcoLogMessage),
        expect.objectContaining({ 
          message: expect.stringContaining('No rebalance')
        })
      )
    })

    it('should handle token rebalances even without WETH rebalances', async () => {
      // Mock processor object
      const mockProcessor = {
        liquidityManagerService: service,
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      }

      // Mock token data
      const mockDeficitAnalysis = {
        items: [
          { 
            config: { address: '0xToken1' },
            analysis: { 
              diff: 100,
              balance: { current: 50n },
              targetSlippage: { min: 150n }
            }
          }
        ]
      }

      // Mock rebalance request for tokens
      const mockTokenRebalance = {
        token: { address: '0xToken1' },
        quotes: [{ amountIn: 100n, amountOut: 95n }]
      }

      // Setup mocks
      jest.spyOn(service, 'analyzeTokens').mockResolvedValue({
        ...mockDeficitAnalysis,
        deficit: mockDeficitAnalysis,
        surplus: { items: [] }
      } as any)

      jest.spyOn(service, 'getOptimizedRebalancing').mockResolvedValue([mockTokenRebalance] as any)
      jest.spyOn(service, 'storeRebalancing').mockResolvedValue(undefined)
      
      // Return empty WETH rebalances
      jest.spyOn(service, 'getWETHRebalances').mockResolvedValue([])
      
      // Call process method
      await checkBalancesCronJobManager.process(mockProcessor as any)
      
      // Verify getWETHRebalances was called
      expect(service.getWETHRebalances).toHaveBeenCalledWith(zeroAddress)
      
      // Verify rebalance job was added with token rebalances only
      const mockJobInfo = expect.objectContaining({
        name: expect.stringContaining('rebalance'),
        data: {
          rebalance: expect.objectContaining({
            walletAddress: zeroAddress,
            rebalances: [mockTokenRebalance]
          })
        }
      })
      
      // Should have logged about adding the job
      expect(mockProcessor.logger.info).toHaveBeenCalledWith(
        expect.any(EcoLogMessage),
        expect.objectContaining({ 
          jobInfo: mockJobInfo
        })
      )
    })
  })
})