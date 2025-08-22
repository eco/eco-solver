const mockInit = jest.fn()
const mockWait = jest.fn()
import { Test, TestingModule } from '@nestjs/testing'
import { FlagService, FlagVariationKeys } from '../flags.service'
import { KernelAccountClientService } from '../../transaction/smart-wallets/kernel/kernel-account-client.service'
import { createMock } from '@golevelup/ts-jest'
import { EcoConfigService } from '@libs/solver-config'

jest.mock('@launchdarkly/node-server-sdk', () => {
  return {
    ...jest.requireActual('@launchdarkly/node-server-sdk'),
    init: mockInit,
  }
})

jest.mock('../utils', () => {
  return {
    ...jest.requireActual('../utils'),
    waitForInitialization: mockWait,
  }
})

describe('Flags', () => {
  let flagService: FlagService
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockVariation = jest.fn()

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlagService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
      ],
    }).compile()
    //turn off the services from logging durring testing
    module.useLogger(false)
    flagService = module.get<FlagService>(FlagService)

    flagService['logger'].debug = mockLogDebug
    flagService['logger'].log = mockLogLog

    mockInit.mockReturnValue({ on: jest.fn(), variation: mockVariation })
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockInit.mockClear()
    mockVariation.mockClear()
    mockWait.mockClear()
  })

  describe('onModuleInit', () => {
    it('should init the launch darkly sdk', async () => {
      await flagService.onModuleInit()
      expect(mockInit).toHaveBeenCalledTimes(1)
    })

    it('should wait for initialization', async () => {
      await flagService.onModuleInit()
      expect(mockWait).toHaveBeenCalledTimes(1)
    })
  })
})
