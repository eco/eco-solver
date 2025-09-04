import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { Hex } from 'viem'
import { HttpService } from '@nestjs/axios'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { SigningService } from '@/request-signing/signing.service'
import { SolverRegistrationService } from './solver-registration.service'

// Stub helpers
const makeIntentSource = (chainID: number, tokens: Hex[]): IntentSource => ({
  chainID,
  tokens,
  network: 'testnet' as any,
  sourceAddress: '0x0000000000000000000000000000000000000000',
  inbox: '0x0000000000000000000000000000000000000000',
  provers: ['0x0000000000000000000000000000000000000000'],
})

const makeSolver = (chainID: number, targets: string[]) =>
  ({
    chainID,
    targets: Object.fromEntries(targets.map((t) => [t, {}])),
  }) as any

let $: EcoTester
let service: SolverRegistrationService

describe('SolverRegistrationService', () => {
  beforeAll(async () => {
    const ecoConfigServiceMock = {
      getServer: jest.fn().mockReturnValue({ url: 'http://localhost' }),
      getSolverRegistrationConfig: jest.fn().mockReturnValue({}),
      getQuotesConfig: jest.fn().mockReturnValue({ intentExecutionTypes: ['SELF_PUBLISH'] }),
      getSolvers: jest.fn(),
      getIntentSources: jest.fn(),
    }

    $ = EcoTester.setupTestFor(SolverRegistrationService)
      .withProviders([
        {
          provide: EcoConfigService, // ⬅ inject the actual mocked provider here
          useValue: ecoConfigServiceMock,
        },
      ])
      .withMocks([HttpService, SigningService])

    service = await $.init()
  })

  beforeEach(() => {
    // swap logger with a silent one to avoid noisy console
    service['logger'] = new EcoLogger('TestLogger')
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {})
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => {})
  })

  it('should map a single solver and source correctly', () => {
    service['solversConfig'] = {
      100: makeSolver(100, ['0xAAA']),
    }
    service['intentSourcesConfig'] = [makeIntentSource(1, ['0xSRC'])]

    const dto = (service as any).getSolverRegistrationDTO()

    expect(dto.crossChainRoutes.crossChainRoutesConfig).toEqual({
      '1': {
        '100': [{ send: '0xSRC', receive: ['0xAAA'] }],
      },
    })
  })

  it('should skip same-chain routes', () => {
    service['solversConfig'] = {
      1: makeSolver(1, ['0xAAA']),
    }
    service['intentSourcesConfig'] = [makeIntentSource(1, ['0xSRC'])]

    const dto = (service as any).getSolverRegistrationDTO()

    expect(dto.crossChainRoutes.crossChainRoutesConfig).toEqual({})
  })

  it('should skip sources with no tokens', () => {
    service['solversConfig'] = {
      100: makeSolver(100, ['0xAAA']),
    }
    service['intentSourcesConfig'] = [makeIntentSource(1, [])]

    const dto = (service as any).getSolverRegistrationDTO()

    expect(dto.crossChainRoutes.crossChainRoutesConfig).toEqual({})
    expect(service['logger'].warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('No tokens configured for intent source chain'),
      }),
    )
  })

  it('should handle multiple solvers and sources', () => {
    service['solversConfig'] = {
      100: makeSolver(100, ['0xAAA']),
      200: makeSolver(200, ['0xBBB']),
    }
    service['intentSourcesConfig'] = [
      makeIntentSource(1, ['0xSRC1']),
      makeIntentSource(2, ['0xSRC2']),
    ]

    const dto = (service as any).getSolverRegistrationDTO()

    expect(dto.crossChainRoutes.crossChainRoutesConfig).toEqual({
      '1': {
        '100': [{ send: '0xSRC1', receive: ['0xAAA'] }],
        '200': [{ send: '0xSRC1', receive: ['0xBBB'] }],
      },
      '2': {
        '100': [{ send: '0xSRC2', receive: ['0xAAA'] }],
        '200': [{ send: '0xSRC2', receive: ['0xBBB'] }],
      },
    })
  })

  it('should dedupe and sort destination tokens', () => {
    service['solversConfig'] = {
      100: makeSolver(100, ['0xCCC', '0xAAA', '0xCCC']),
    }
    service['intentSourcesConfig'] = [makeIntentSource(1, ['0xSRC'])]

    const dto = (service as any).getSolverRegistrationDTO()
    const receive = dto.crossChainRoutes.crossChainRoutesConfig['1']['100'][0].receive

    expect(receive).toEqual(['0xAAA', '0xCCC']) // sorted unique
  })
})
