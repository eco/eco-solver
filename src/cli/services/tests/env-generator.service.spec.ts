import { Test, TestingModule } from '@nestjs/testing';

import { ConfigModule } from '@/modules/config/config.module';

import { EnvGeneratorService } from '../env-generator.service';

describe('EnvGeneratorService', () => {
  let service: EnvGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [EnvGeneratorService],
    }).compile();

    service = module.get<EnvGeneratorService>(EnvGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateEnvEntries', () => {
    it('should generate environment variables from configuration', async () => {
      const entries = await service.generateEnvEntries();

      // Should have entries
      expect(entries.length).toBeGreaterThan(0);

      // Should be sorted alphabetically
      const names = entries.map((e) => e.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);

      // Should have standard config entries
      expect(entries.some((e) => e.name === 'MONGODB_URI')).toBe(true);
      expect(entries.some((e) => e.name === 'REDIS_HOST')).toBe(true);
    });

    it('should handle special cases correctly', async () => {
      const entries = await service.generateEnvEntries();

      // Check special case mappings
      expect(entries.some((e) => e.name === 'NODE_ENV')).toBe(true);
      expect(entries.some((e) => e.name === 'PORT')).toBe(true);
    });

    it('should flatten arrays with indices', async () => {
      const entries = await service.generateEnvEntries();

      // Should have indexed array entries like EVM_NETWORKS_0_CHAIN_ID
      const arrayEntries = entries.filter((e) => /\d+/.test(e.name));
      expect(arrayEntries.length).toBeGreaterThan(0);
    });
  });

  describe('generateEnvFileContent', () => {
    it('should generate valid .env file content', () => {
      const entries = [
        { name: 'HOST', value: 'localhost' },
        { name: 'PORT', value: '3000' },
        { name: 'DEBUG', value: 'true' },
      ];

      const content = service.generateEnvFileContent(entries);

      expect(content).toBe('HOST=localhost\nPORT=3000\nDEBUG=true\n');
    });

    it('should handle quoted values', () => {
      const entries = [{ name: 'MESSAGE', value: '"hello world"' }];

      const content = service.generateEnvFileContent(entries);

      expect(content).toBe('MESSAGE="hello world"\n');
    });

    it('should end with newline', () => {
      const entries = [{ name: 'VAR', value: 'value' }];
      const content = service.generateEnvFileContent(entries);

      expect(content.endsWith('\n')).toBe(true);
    });
  });
});
