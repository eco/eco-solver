import { Test, TestingModule } from '@nestjs/testing'
import { EcoSolverConfigService } from './eco-solver-config.service'
import { ConfigSource } from '../interfaces/config-source.interface'

describe('EcoSolverConfigService (Architectural Separation)', () => {
  let service: EcoSolverConfigService

  beforeEach(async () => {
    const mockConfigSource: ConfigSource = {
      name: 'MockConfig',
      priority: 100,
      enabled: true,
      getConfig: jest.fn().mockResolvedValue({
        cache: { ttl: 10000 },
        server: { url: 'http://localhost:3000', port: 3000 },
        solvers: {},
        intentSources: [],
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EcoSolverConfigService,
          useFactory: () => new EcoSolverConfigService([mockConfigSource]),
        },
      ],
    }).compile()

    service = module.get<EcoSolverConfigService>(EcoSolverConfigService)
    await service.initializeConfig()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should initialize configuration from config sources', async () => {
    const debugInfo = service.getDebugInfo()
    expect(debugInfo.initialized).toBe(true)
    expect(debugInfo.sourcesCount).toBe(1)
  })

  it('should provide cache configuration', () => {
    const cacheConfig = service.getCache()
    expect(cacheConfig).toBeDefined()
    expect(cacheConfig?.ttl).toBe(10000)
  })

  it('should provide server configuration', () => {
    const serverConfig = service.getServer()
    expect(serverConfig).toBeDefined()
    expect(serverConfig?.url).toBe('http://localhost:3000')
  })

  it('should handle solvers configuration', () => {
    const solvers = service.getSolvers()
    expect(typeof solvers).toBe('object')
  })

  it('should handle intent sources configuration', () => {
    const intentSources = service.getIntentSources()
    expect(Array.isArray(intentSources)).toBe(true)
  })
})