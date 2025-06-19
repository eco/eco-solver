import { Test, TestingModule } from '@nestjs/testing'
import { LitActionService } from './lit-action.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { PublicClient } from 'viem'

describe('LitActionService', () => {
  let service: LitActionService
  let ecoConfigService: EcoConfigService

  const mockCrowdLiquidityConfig = {
    litNetwork: 'datil-test' as any,
    capacityTokenId: 'test-capacity-token',
    capacityTokenOwnerPk: '0x1234567890123456789012345678901234567890123456789012345678901234',
    defaultTargetBalance: 1000,
    feePercentage: 0.01,
    actions: {
      fulfill: 'ipfs://fulfill-action',
      rebalance: 'ipfs://rebalance-action',
      negativeIntentRebalance: 'ipfs://negative-intent-rebalance',
    },
    kernel: {
      address: '0x6666666666666666666666666666666666666666',
    },
    pkp: {
      ethAddress: '0x7777777777777777777777777777777777777777',
      publicKey: 'test-public-key',
    },
    supportedTokens: [],
  }

  const mockPublicClient = {
    sendRawTransaction: jest.fn().mockResolvedValue('0xmocktxhash'),
  } as unknown as PublicClient

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LitActionService,
        {
          provide: EcoConfigService,
          useValue: {
            getCrowdLiquidity: jest.fn().mockReturnValue(mockCrowdLiquidityConfig),
          },
        },
      ],
    }).compile()

    service = module.get<LitActionService>(LitActionService)
    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('executeFulfillAction', () => {
    it('should call executeLitAction with correct parameters', async () => {
      const mockIntent = {
        route: { salt: '0x123', source: 1, destination: 10 },
        reward: { creator: '0xabc', prover: '0xdef' },
      }
      const publicKey = 'test-public-key'
      const kernelAddress = '0x6666'
      const transaction = { nonce: 1, gasLimit: 1000000 }

      jest.spyOn(service, 'executeLitAction').mockResolvedValue('0xresulthash')

      const result = await service.executeFulfillAction(
        mockIntent,
        publicKey,
        kernelAddress,
        transaction,
        mockPublicClient,
      )

      expect(result).toBe('0xresulthash')
      expect(service.executeLitAction).toHaveBeenCalledWith(
        'ipfs://fulfill-action',
        mockPublicClient,
        {
          intent: mockIntent,
          publicKey,
          kernelAddress,
          transaction,
        },
      )
    })
  })

  describe('executeRebalanceCCTPAction', () => {
    it('should call executeLitAction with correct parameters', async () => {
      const chainId = 1
      const tokenAddress = '0xtoken' as any
      const tokenChainId = 10
      const publicKey = 'test-public-key'
      const kernelAddress = '0x6666'
      const transaction = { nonce: 1, gasLimit: 1000000 }

      jest.spyOn(service, 'executeLitAction').mockResolvedValue('0xresulthash')

      const result = await service.executeRebalanceCCTPAction(
        chainId,
        tokenAddress,
        tokenChainId,
        publicKey,
        kernelAddress,
        transaction,
        mockPublicClient,
      )

      expect(result).toBe('0xresulthash')
      expect(service.executeLitAction).toHaveBeenCalledWith(
        'ipfs://rebalance-action',
        mockPublicClient,
        {
          chainId,
          tokenAddress,
          tokenChainId,
          publicKey,
          kernelAddress,
          transaction,
        },
      )
    })
  })

  describe('executeNegativeIntentRebalanceAction', () => {
    it('should call executeLitAction with correct parameters', async () => {
      const intentHash = '0xintent' as any
      const publicKey = 'test-public-key'
      const kernelAddress = '0x6666'
      const transaction = { nonce: 1, gasLimit: 1000000 }

      jest.spyOn(service, 'executeLitAction').mockResolvedValue('0xresulthash')

      const result = await service.executeNegativeIntentRebalanceAction(
        intentHash,
        publicKey,
        kernelAddress,
        transaction,
        mockPublicClient,
      )

      expect(result).toBe('0xresulthash')
      expect(service.executeLitAction).toHaveBeenCalledWith(
        'ipfs://negative-intent-rebalance',
        mockPublicClient,
        {
          intentHash,
          publicKey,
          kernelAddress,
          transaction,
        },
      )
    })

    it('should fallback to fulfill action if negativeIntentRebalance not configured', async () => {
      // Create a new instance with config without negativeIntentRebalance
      const configWithoutNegativeAction = {
        ...mockCrowdLiquidityConfig,
        actions: {
          fulfill: 'ipfs://fulfill-action',
          rebalance: 'ipfs://rebalance-action',
          negativeIntentRebalance: undefined,
        },
      }

      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          LitActionService,
          {
            provide: EcoConfigService,
            useValue: {
              getCrowdLiquidity: jest.fn().mockReturnValue(configWithoutNegativeAction),
            },
          },
        ],
      }).compile()

      const testService = testModule.get<LitActionService>(LitActionService)

      const intentHash = '0xintent' as any
      const publicKey = 'test-public-key'
      const kernelAddress = '0x6666'
      const transaction = { nonce: 1, gasLimit: 1000000 }

      jest.spyOn(testService, 'executeLitAction').mockResolvedValue('0xresulthash')

      await testService.executeNegativeIntentRebalanceAction(
        intentHash,
        publicKey,
        kernelAddress,
        transaction,
        mockPublicClient,
      )

      expect(testService.executeLitAction).toHaveBeenCalledWith(
        'ipfs://fulfill-action',
        mockPublicClient,
        expect.any(Object),
      )
    })
  })
})