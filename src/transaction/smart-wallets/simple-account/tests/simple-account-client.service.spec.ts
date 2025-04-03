import { Test, TestingModule } from '@nestjs/testing'
import { SimpleAccountClientService } from '../simple-account-client.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { SignerService } from '@/sign/signer.service'
import { createMock } from '@golevelup/ts-jest'
import { Chain, Hex, Address, Account } from 'viem'
import { EcoError } from '@/common/errors/eco-error'

// Mock external dependencies
jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  createWalletClient: jest.fn().mockReturnValue({ 
    extend: jest.fn().mockImplementation(function(this: any, actions: any) {
      return {
        ...this,
        ...actions(this),
        extend: this.extend
      }
    })
  }),
  publicActions: jest.fn().mockReturnValue({}),
  extractChain: jest.fn(),
}))

jest.mock('../create.simple.account', () => ({
  createSimpleAccountClient: jest.fn().mockImplementation((config) => ({
    ...config,
    simpleAccountAddress: config.simpleAccountAddress,
    extend: jest.fn().mockReturnThis(),
    sendTransaction: jest.fn().mockResolvedValue('0xtxhash' as Hex)
  }))
}))

describe('SimpleAccountClientService', () => {
  let service: SimpleAccountClientService
  let ecoConfigService: EcoConfigService
  let signerService: SignerService

  const mockSimpleAccountConfig = {
    walletAddr: '0xsimpleaccount' as Hex
  }

  const mockAccount: Account = {
    address: '0xsigner' as Address,
    signMessage: jest.fn().mockResolvedValue('0xsignature' as Hex),
    signTransaction: jest.fn().mockImplementation(() => 
      Promise.resolve('0xsignedtx' as Hex)
    ),
    signTypedData: jest.fn().mockResolvedValue('0xsignature' as Hex),
    publicKey: '0xpublickey' as Hex,
    type: 'local',
    source: 'test'
  } as unknown as Account

  beforeEach(async () => {
    ecoConfigService = createMock<EcoConfigService>({
      getAlchemy: jest.fn().mockReturnValue({
        apiKey: 'test-api-key',
        networks: [{ id: 1, name: 'ethereum' }]
      }),
      getEth: jest.fn().mockReturnValue({
        pollingInterval: 4000,
        simpleAccount: mockSimpleAccountConfig
      })
    })
    
    signerService = createMock<SignerService>({
      getAccount: jest.fn().mockReturnValue(mockAccount),
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimpleAccountClientService,
        { provide: EcoConfigService, useValue: ecoConfigService },
        { provide: SignerService, useValue: signerService },
      ],
    }).compile()

    service = module.get<SimpleAccountClientService>(SimpleAccountClientService)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('buildChainConfig', () => {
    it('should extend base config with simple account address and account', async () => {
      // Create a mock chain
      const mockChain: Chain = {
        id: 1,
        name: 'Ethereum',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: ['https://ethereum.example.com'] },
        },
      }

      // Mock base config from parent class
      const baseConfig = {
        transport: { type: 'http' },
        chain: mockChain,
      }

      // Spy on parent method
      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'buildChainConfig')
        .mockResolvedValue(baseConfig)

      const result = await service['buildChainConfig'](mockChain)

      expect(result).toEqual({
        ...baseConfig,
        simpleAccountAddress: mockSimpleAccountConfig.walletAddr,
        account: mockAccount,
      })
    })

    it('should throw error if simple account config is missing', async () => {
      // Create a mock chain
      const mockChain: Chain = {
        id: 1,
        name: 'Ethereum',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: ['https://ethereum.example.com'] },
        },
      }

      // Mock base config from parent class
      const baseConfig = {
        transport: { type: 'http' },
        chain: mockChain,
      }

      // Spy on parent method
      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'buildChainConfig')
        .mockResolvedValue(baseConfig)

      // Return null for simpleAccount config
      ecoConfigService.getEth = jest.fn().mockReturnValue({
        pollingInterval: 4000,
        simpleAccount: null
      })

      await expect(service['buildChainConfig'](mockChain)).rejects.toBeInstanceOf(EcoError)
    })
  })

  describe('createInstanceClient', () => {
    it('should call createSimpleAccountClient with the provided config', async () => {
      const createSimpleAccountClient = require('../create.simple.account').createSimpleAccountClient

      const mockConfig = {
        transport: { type: 'http' },
        chain: { id: 1 } as Chain,
        simpleAccountAddress: '0xsimpleaccount' as Hex,
        account: mockAccount
      }

      await service['createInstanceClient'](mockConfig as any)

      expect(createSimpleAccountClient).toHaveBeenCalledWith(mockConfig)
    })
  })

  describe('getClient', () => {
    it('should call createInstanceClient when creating a client', async () => {
      const createInstanceSpy = jest.spyOn(service as any, 'createInstanceClient')
        .mockResolvedValue({
          simpleAccountAddress: '0xsimpleaccount',
          chain: { id: 1 }
        })
      
      // Mock getChainConfig to avoid the chain extraction error
      jest.spyOn(service as any, 'getChainConfig')
        .mockResolvedValue({
          transport: { type: 'http' },
          chain: { id: 1 },
          simpleAccountAddress: '0xsimpleaccount' as Hex,
          account: mockAccount
        })
        
      // Mock instances.has to return false initially
      const originalInstancesHas = service.instances.has;
      service.instances.has = jest.fn().mockReturnValue(false);
      
      // First call should create new instance
      await service.getClient(1)
      expect(createInstanceSpy).toHaveBeenCalledTimes(1)
      
      // Restore original function
      service.instances.has = originalInstancesHas;
    })
  })
})