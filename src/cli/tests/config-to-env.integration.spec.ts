import { Test, TestingModule } from '@nestjs/testing';

import { ConfigFactory } from '@/config/config-factory';

import { CliModule } from '../cli.module';
import { EnvGeneratorService } from '../services/env-generator.service';

describe('Config-to-Env Integration', () => {
  let service: EnvGeneratorService;

  beforeAll(async () => {
    // Load configuration
    await ConfigFactory.loadConfig();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CliModule],
    }).compile();

    service = module.get<EnvGeneratorService>(EnvGeneratorService);
  });

  it('should generate complete .env file content', async () => {
    const entries = await service.generateEnvEntries();
    const content = service.generateEnvFileContent(entries);

    // Should be non-empty
    expect(content.length).toBeGreaterThan(0);

    // Should have multiple lines
    const lines = content.split('\n').filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThan(10);

    // All lines should be in KEY=VALUE format
    // Note: Keys can contain dots for record types (e.g., OPENTELEMETRY_RESOURCE_ATTRIBUTES_DEPLOYMENT.ENVIRONMENT)
    lines.forEach((line) => {
      expect(line).toMatch(/^[A-Z_0-9.]+=.*/);
    });
  });

  it('should generate entries matching schema structure', async () => {
    const entries = await service.generateEnvEntries();
    const entryNames = entries.map((e) => e.name);

    // Check presence of major configuration domains
    expect(entryNames.some((n) => n.startsWith('MONGODB_'))).toBe(true);
    expect(entryNames.some((n) => n.startsWith('REDIS_'))).toBe(true);
    expect(entryNames.some((n) => n.startsWith('EVM_'))).toBe(true);
  });

  it('should be alphabetically sorted', async () => {
    const entries = await service.generateEnvEntries();
    const names = entries.map((e) => e.name);

    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  });
});
