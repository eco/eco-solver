import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EcoConfigService } from './eco-config.service';
import { EcoConfigModule } from './eco-config.module';

describe('EcoConfigService', () => {
  let service: EcoConfigService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EcoConfigModule.forTesting({
        test: {
          value: 'test-config'
        },
        server: {
          port: 3001,
          host: 'localhost'
        }
      })],
    }).compile();

    service = module.get<EcoConfigService>(EcoConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get server configuration', () => {
    const serverConfig = service.getServerConfig();
    expect(serverConfig).toBeDefined();
    expect(serverConfig.port).toBeDefined();
    expect(serverConfig.host).toBeDefined();
  });

  it('should get configuration by path', () => {
    const testValue = service.get('test.value');
    expect(testValue).toBe('test-config');
  });

  it('should return default value for missing config', () => {
    const missingValue = service.get('missing.config', 'default');
    expect(missingValue).toBe('default');
  });

  it('should check if configuration exists', () => {
    expect(service.has('test.value')).toBe(true);
    expect(service.has('missing.config')).toBe(false);
  });

  it('should get environment', () => {
    const env = service.getEnvironment();
    expect(env).toBeDefined();
  });

  it('should check development environment', () => {
    const isDev = service.isDevelopment();
    expect(typeof isDev).toBe('boolean');
  });
});