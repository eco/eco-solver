import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { ValidSmartWalletService } from '../valid-smart-wallet.service'
import { MultichainPublicClientService } from '../../../transaction/multichain-public-client.service'
import { EcoConfigService } from '../../../eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'

describe('ValidSmartWalletService Tests', () => {
  let validWalletService: ValidSmartWalletService
  let publicClientService: DeepMocked<MultichainPublicClientService>
  let ecoConfigService: DeepMocked<EcoConfigService>

  beforeEach(async () => {
    const validMod: TestingModule = await Test.createTestingModule({
      providers: [
        ValidSmartWalletService,
        {
          provide: MultichainPublicClientService,
          useValue: createMock<MultichainPublicClientService>(),
        },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
      ],
    }).compile()

    validWalletService = validMod.get(ValidSmartWalletService)
    publicClientService = validMod.get(MultichainPublicClientService)
    ecoConfigService = validMod.get(EcoConfigService)
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
  })
  const entryPoint = '0x123'
  const factory = '0x456'

  describe('on startup', () => {
    it('should initialize the entry point and factory addresses', async () => {
      const contracts = {
        entryPoint: { contractAddress: entryPoint },
        simpleAccountFactory: { contractAddress: factory },
      }
      ecoConfigService.getEth = jest.fn().mockReturnValue({ simpleAccount: { contracts } })

      validWalletService.onModuleInit()

      expect(validWalletService['entryPointAddress']).toEqual(entryPoint)
      expect(validWalletService['factoryAddress']).toEqual(factory)
    })
  })

  describe('on validate smart wallet', () => {
    beforeEach(() => {
      validWalletService['entryPointAddress'] = entryPoint
      validWalletService['factoryAddress'] = factory
    })

    it('should return false if there are no deploy events for a SA address', async () => {
      publicClientService.getClient = jest.fn().mockImplementation(async (chainID) => {
        return {
          getContractEvents: jest.fn().mockReturnValue([]),
        }
      })
      const result = await validWalletService.validateSmartWallet('0x789', 1n)
      expect(result).toEqual(false)
    })

    it('should return false if the SA address is from another factory', async () => {
      publicClientService.getClient = jest.fn().mockImplementation(async (chainID) => {
        return {
          getContractEvents: jest.fn().mockReturnValue([{ args: { factory: '0xabc' } }]),
        }
      })
      const result = await validWalletService.validateSmartWallet('0x789', 1n)
      expect(result).toEqual(false)
    })

    it('should return true if the SA is from our factory', async () => {
      publicClientService.getClient = jest.fn().mockImplementation(async (chainID) => {
        return {
          getContractEvents: jest.fn().mockReturnValue([{ args: { factory: factory } }]),
        }
      })
      const result = await validWalletService.validateSmartWallet('0x789', 1n)
      expect(result).toEqual(true)
    })
  })
})
