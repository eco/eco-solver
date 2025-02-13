import { Test, TestingModule } from '@nestjs/testing'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { KMSWallets } from '@web3-kms-signer/kms-wallets'
import { Signer } from '@web3-kms-signer/core'
import { Logger } from '@nestjs/common'
import { KmsService } from '@/kms/kms.service'
import { createMock, DeepMocked } from '@golevelup/ts-jest'

describe('KmsService', () => {
  let service: KmsService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let logger: Logger

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KmsService,
        {
          provide: EcoConfigService,
          useValue: createMock<EcoConfigService>(),
        },
      ],
    }).compile()

    service = module.get<KmsService>(KmsService)
    ecoConfigService = module.get(EcoConfigService)
    logger = new Logger()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should throw an error if KMS config is missing', async () => {
    jest.spyOn(ecoConfigService, 'getKmsConfig').mockReturnValue(null as any)
    await expect(service.onModuleInit()).rejects.toThrow(EcoError.KmsCredentialsError(null as any))
  })
})
