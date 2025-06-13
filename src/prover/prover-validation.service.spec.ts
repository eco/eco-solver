import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { ProverValidationService } from './prover-validation.service'
import { PublicClient } from 'viem'
import { Test, TestingModule } from '@nestjs/testing'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

const mockIntentSources = [
  {
    chainID: 10,
    provers: ['0xProverAddress1'],
  },
  {
    chainID: 42161,
    provers: ['0xProverAddress2'],
  },
]

const mockEcoConfigService = {
  getIntentSources: jest.fn().mockReturnValue(mockIntentSources),
}

const mockWalletClientDefaultSignerService = {
  getPublicClient: jest.fn(),
}

const mockPublicClient: Partial<PublicClient> = {
  getCode: jest.fn(),
}

describe('ProverValidationService', () => {
  let service: ProverValidationService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProverValidationService,
        { provide: EcoConfigService, useValue: mockEcoConfigService },
        { provide: WalletClientDefaultSignerService, useValue: mockWalletClientDefaultSignerService },
      ],
    }).compile()

    service = module.get(ProverValidationService)

    jest.clearAllMocks()
  })

  it('should initialize provers and hashes correctly', async () => {
    mockEcoConfigService.getIntentSources.mockReturnValue([
      {
        chainID: 1,
        provers: [
          { toLowerCase: () => '0xabc' },
        ],
      },
    ])

    service['setupProverValidationData']()

    const hashes = service['knownProverHashes'].get(1)
    expect(hashes).toBeDefined()
    expect(hashes!.has('0xabc')).toBe(true)
  })

  it('should return error for unknown prover', async () => {
    service['knownProverHashes'].set(1, new Map())

    const result = await service.validateProver(1, '0xdef')
    expect(result.error).toEqual(EcoError.ProverNotRegistered(1, '0xdef'))
  })

  it('should return error for undeployed prover', async () => {
    const addr = '0xabc'
    const lowerAddr = addr.toLowerCase()

    const mockCode = jest.fn().mockResolvedValue('0x')
    mockPublicClient.getCode = mockCode
    mockWalletClientDefaultSignerService.getPublicClient.mockResolvedValue(mockPublicClient)

    const map = new Map()
    map.set(lowerAddr, '0x')
    service['knownProverHashes'].set(1, map)

    const result = await service.validateProver(1, addr)
    expect(result.error).toEqual(EcoError.NoContractDeployed(1, addr))
  })
})
