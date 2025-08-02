import { Test, TestingModule } from '@nestjs/testing';

import { AwsSecretsService } from '@/modules/config/services/aws-secrets.service';

describe('AwsSecretsService', () => {
  let service: AwsSecretsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AwsSecretsService],
    }).compile();

    service = module.get<AwsSecretsService>(AwsSecretsService);
  });

  describe('mergeSecrets', () => {
    it('should deep merge AWS secrets with base config', () => {
      const baseConfig = {
        env: 'development',
        port: 3000,
        mongodb: {
          uri: 'mongodb://localhost:27017/test',
        },
        redis: {
          host: 'localhost',
          port: 6379,
          password: undefined,
        },
        evm: {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          privateKey: 'test-key',
        },
      };

      const awsSecrets = {
        MONGODB_URI: 'mongodb://prod-server:27017/prod-db',
        REDIS_PASSWORD: 'secret-password',
        REDIS_PORT: '6380',
        EVM_RPC_URL: 'https://mainnet.infura.io/v3/key',
        EVM_CHAIN_ID: '137',
        SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      };

      const result = service.mergeSecrets(baseConfig, awsSecrets);

      // Check that AWS secrets override base config
      expect(result.mongodb.uri).toBe('mongodb://prod-server:27017/prod-db');
      expect(result.redis.password).toBe('secret-password');
      expect(result.redis.port).toBe(6380); // Should be converted to number
      expect(result.evm.rpcUrl).toBe('https://mainnet.infura.io/v3/key');
      expect(result.evm.chainId).toBe(137); // Should be converted to number

      // Check that non-overridden values remain
      expect(result.env).toBe('development');
      expect(result.port).toBe(3000);
      expect(result.redis.host).toBe('localhost');
      expect(result.evm.privateKey).toBe('test-key');

      // Check that new values are added
      expect(result.solana).toBeDefined();
      expect(result.solana.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
    });

    it('should handle empty secrets', () => {
      const baseConfig = {
        env: 'development',
        port: 3000,
      };

      const result = service.mergeSecrets(baseConfig, {});

      expect(result).toEqual(baseConfig);
    });

    it('should handle nested overrides correctly', () => {
      const baseConfig = {
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'old-password',
          options: {
            timeout: 5000,
          },
        },
      };

      const awsSecrets = {
        REDIS_PASSWORD: 'new-password',
      };

      const result = service.mergeSecrets(baseConfig, awsSecrets);

      // Password should be updated
      expect(result.redis.password).toBe('new-password');
      // Other values should remain
      expect(result.redis.host).toBe('localhost');
      expect(result.redis.port).toBe(6379);
      expect(result.redis.options?.timeout).toBe(5000);
    });
  });
});
