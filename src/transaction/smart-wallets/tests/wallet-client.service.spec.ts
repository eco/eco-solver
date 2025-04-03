import { Test, TestingModule } from '@nestjs/testing'
import { WalletClientService, WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { SignerService } from '@/sign/signer.service'
import { createMock } from '@golevelup/ts-jest'
import { extractChain, createPublicClient, createWalletClient } from 'viem'
import { ChainsSupported } from '@/common/chains/supported'

// Mock external dependencies
jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  createPublicClient: jest.fn().mockReturnValue({ publicClient: true }),
  createWalletClient: jest.fn().mockReturnValue({ walletClient: true }),
  extractChain: jest.fn(),
}))

jest.mock('@/common/chains/supported', () => ({
  ChainsSupported: [
    {
      id: 1,
      name: 'Ethereum',
      rpcUrls: {
        default: { http: ['https://ethereum.example.com'] },
      },
    },
  ],
}))

describe('WalletClientService', () => {
  // Create a concrete implementation of WalletClientService for testing
  class TestWalletClientService extends WalletClientService {
    getAccount() {
      return Promise.resolve({ address: '0xtest' })
    }
  }

  let service: TestWalletClientService
  let ecoConfigService: EcoConfigService

  beforeEach(async () => {
    ecoConfigService = createMock<EcoConfigService>({
      getTransports: jest.fn().mockReturnValue({
        rpcUrls: {
          '1': 'https://eth-mainnet.example.com',
        },
      }),
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TestWalletClientService,
          useFactory: (ecoConfigService: EcoConfigService) => {
            return new TestWalletClientService(ecoConfigService)
          },
          inject: [EcoConfigService],
        },
        { provide: EcoConfigService, useValue: ecoConfigService },
      ],
    }).compile()

    service = module.get<TestWalletClientService>(TestWalletClientService)

    // Mock extractChain
    ;(extractChain as jest.Mock).mockReturnValue({
      id: 1,
      name: 'Ethereum',
      rpcUrls: {
        default: { http: ['https://ethereum.example.com'] },
      },
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getPublicClient', () => {
    it('should create a public client for the specified chain', async () => {
      const result = await service.getPublicClient(1)

      expect(extractChain).toHaveBeenCalledWith({
        chains: ChainsSupported,
        id: 1,
      })

      expect(createPublicClient).toHaveBeenCalled()
      expect(result).toEqual({ publicClient: true })
    })
  })

  describe('createInstanceClient', () => {
    it('should create a wallet client with the provided config', async () => {
      const config = { 
        account: { address: '0xtest' },
        chain: { id: 1, name: 'Ethereum' },
        transport: { type: 'http', url: 'https://ethereum.example.com' },
      }

      const result = await service['createInstanceClient'](config as any)

      expect(createWalletClient).toHaveBeenCalledWith(config)
      expect(result).toEqual({ walletClient: true })
    })
  })

  describe('buildChainConfig', () => {
    it('should build config with account', async () => {
      const chain = {
        id: 1,
        name: 'Ethereum',
      }

      const spy = jest.spyOn(service, 'getAccount').mockResolvedValue({ address: '0xtest' } as any)

      const result = await service['buildChainConfig'](chain as any)

      expect(spy).toHaveBeenCalled()
      expect(result).toHaveProperty('account')
      expect(result.account).toEqual({ address: '0xtest' })
    })
  })
})

describe('WalletClientDefaultSignerService', () => {
  let service: WalletClientDefaultSignerService
  let ecoConfigService: EcoConfigService
  let signerService: SignerService

  beforeEach(async () => {
    ecoConfigService = createMock<EcoConfigService>()
    
    signerService = createMock<SignerService>({
      getAccount: jest.fn().mockReturnValue({ address: '0xsigner' }),
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletClientDefaultSignerService,
        { provide: EcoConfigService, useValue: ecoConfigService },
        { provide: SignerService, useValue: signerService },
      ],
    }).compile()

    service = module.get<WalletClientDefaultSignerService>(WalletClientDefaultSignerService)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getAccount', () => {
    it('should return the account from signer service', async () => {
      const result = await service.getAccount()

      expect(signerService.getAccount).toHaveBeenCalled()
      expect(result).toEqual({ address: '0xsigner' })
    })
  })
})