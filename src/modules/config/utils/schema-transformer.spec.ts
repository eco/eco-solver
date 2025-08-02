import { z } from 'zod';

import {
  envVarToPath,
  pathToEnvVar,
  transformEnvVarsToConfig,
} from '@/modules/config/utils/schema-transformer';

describe('Schema Transformer', () => {
  describe('pathToEnvVar', () => {
    it('should convert simple paths to environment variables', () => {
      expect(pathToEnvVar(['mongodb', 'uri'])).toBe('MONGODB_URI');
      expect(pathToEnvVar(['redis', 'host'])).toBe('REDIS_HOST');
      expect(pathToEnvVar(['port'])).toBe('PORT');
    });

    it('should handle camelCase conversion', () => {
      expect(pathToEnvVar(['evm', 'chainId'])).toBe('EVM_CHAIN_ID');
      expect(pathToEnvVar(['evm', 'rpcUrl'])).toBe('EVM_RPC_URL');
      expect(pathToEnvVar(['evm', 'intentSourceAddress'])).toBe('EVM_INTENT_SOURCE_ADDRESS');
    });

    it('should handle array indices', () => {
      expect(pathToEnvVar(['evm', 'network', '10', 'rpcUrls', '0'])).toBe('EVM_NETWORK_10_RPC_URLS_0');
    });
  });

  describe('envVarToPath', () => {
    it('should convert simple environment variables to paths', () => {
      expect(envVarToPath('MONGODB_URI')).toEqual(['mongodb', 'uri']);
      expect(envVarToPath('REDIS_HOST')).toEqual(['redis', 'host']);
      expect(envVarToPath('PORT')).toEqual(['port']);
    });

    it('should handle common patterns', () => {
      expect(envVarToPath('EVM_CHAIN_ID')).toEqual(['evm', 'chainId']);
      expect(envVarToPath('EVM_RPC_URL')).toEqual(['evm', 'rpcUrl']);
      expect(envVarToPath('EVM_INTENT_SOURCE_ADDRESS')).toEqual(['evm', 'intentSourceAddress']);
      expect(envVarToPath('USE_AWS_SECRETS')).toEqual(['aws', 'useAwsSecrets']);
    });

    it('should handle array indices', () => {
      expect(envVarToPath('EVM_NETWORK_10_RPC_URLS_0')).toEqual(['evm', 'network', '10', 'rpcUrls', '0']);
    });
  });

  describe('transformEnvVarsToConfig', () => {
    it('should transform flat environment variables to nested config', () => {
      const TestSchema = z.object({
        mongodb: z.object({
          uri: z.string(),
        }),
        redis: z.object({
          host: z.string(),
          port: z.number(),
        }),
        evm: z.object({
          chainId: z.number(),
          rpcUrl: z.string(),
        }),
        aws: z.object({
          useAwsSecrets: z.boolean(),
        }),
      });

      const envVars = {
        MONGODB_URI: 'mongodb://localhost:27017/test',
        REDIS_HOST: 'redis-server',
        REDIS_PORT: '6380',
        EVM_CHAIN_ID: '137',
        EVM_RPC_URL: 'https://polygon-rpc.com',
        USE_AWS_SECRETS: 'true',
      };

      const result = transformEnvVarsToConfig(envVars, TestSchema);

      expect(result).toEqual({
        mongodb: {
          uri: 'mongodb://localhost:27017/test',
        },
        redis: {
          host: 'redis-server',
          port: 6380,
        },
        evm: {
          chainId: 137,
          rpcUrl: 'https://polygon-rpc.com',
        },
        aws: {
          useAwsSecrets: true,
        },
      });
    });

    it('should handle type conversions', () => {
      const TestSchema = z.object({
        port: z.number(),
        redis: z.object({
          port: z.number(),
        }).optional(),
        queue: z.object({
          concurrency: z.number(),
        }).optional(),
        aws: z.object({
          useAwsSecrets: z.boolean(),
        }).optional(),
      });

      const envVars = {
        PORT: '8080',
        REDIS_PORT: '6379',
        QUEUE_CONCURRENCY: '10',
        USE_AWS_SECRETS: 'false',
      };

      const result = transformEnvVarsToConfig(envVars, TestSchema);

      expect(result.port).toBe(8080);
      expect(result.redis?.port).toBe(6379);
      expect(result.queue?.concurrency).toBe(10);
      expect(result.aws?.useAwsSecrets).toBe(false);
    });

    it('should handle optional values', () => {
      const TestSchema = z.object({
        redis: z.object({
          password: z.string().optional(),
        }).optional(),
        evm: z.object({
          walletAddress: z.string().optional(),
        }).optional(),
      });

      const envVars = {
        REDIS_PASSWORD: 'secret',
        EVM_WALLET_ADDRESS: '0x1234567890123456789012345678901234567890',
      };

      const result = transformEnvVarsToConfig(envVars, TestSchema);

      expect(result.redis?.password).toBe('secret');
      expect(result.evm?.walletAddress).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should work with complex nested schemas', () => {
      const TestSchema = z.object({
        app: z.object({
          server: z.object({
            host: z.string(),
            port: z.number(),
          }),
        }),
        database: z.object({
          connections: z.array(z.object({
            url: z.string(),
            poolSize: z.number(),
          })),
        }),
      });

      const envVars = {
        APP_SERVER_HOST: 'localhost',
        APP_SERVER_PORT: '3000',
        DATABASE_CONNECTIONS_0_URL: 'postgres://db1',
        DATABASE_CONNECTIONS_0_POOL_SIZE: '10',
        DATABASE_CONNECTIONS_1_URL: 'postgres://db2',
        DATABASE_CONNECTIONS_1_POOL_SIZE: '20',
      };

      const result = transformEnvVarsToConfig(envVars, TestSchema);

      expect(result).toEqual({
        app: {
          server: {
            host: 'localhost',
            port: 3000,
          },
        },
        database: {
          connections: [
            { url: 'postgres://db1', poolSize: 10 },
            { url: 'postgres://db2', poolSize: 20 },
          ],
        },
      });
    });

    it('should handle array vs object key disambiguation', () => {
      // Schema with both array and object patterns
      const TestSchema = z.object({
        evm: z.object({
          // network is an array
          network: z.array(z.object({
            chainId: z.number(),
            rpcUrl: z.string(),
          })),
          // chainConfig is an object with numeric keys
          chainConfig: z.record(z.string(), z.object({
            rpcUrl: z.string(),
            wsUrl: z.string().optional(),
          })),
        }),
      });

      const envVars = {
        // These should be treated as array indices
        EVM_NETWORK_0_CHAIN_ID: '1',
        EVM_NETWORK_0_RPC_URL: 'https://eth-mainnet.com',
        EVM_NETWORK_1_CHAIN_ID: '8453',
        EVM_NETWORK_1_RPC_URL: 'https://base-mainnet.com',
        // These should be treated as object keys
        EVM_CHAIN_CONFIG_8453_RPC_URL: 'https://base-config.com',
        EVM_CHAIN_CONFIG_8453_WS_URL: 'wss://base-config.com',
      };

      const result = transformEnvVarsToConfig(envVars, TestSchema);

      expect(result).toEqual({
        evm: {
          network: [
            { chainId: 1, rpcUrl: 'https://eth-mainnet.com' },
            { chainId: 8453, rpcUrl: 'https://base-mainnet.com' },
          ],
          chainConfig: {
            '8453': {
              rpcUrl: 'https://base-config.com',
              wsUrl: 'wss://base-config.com',
            },
          },
        },
      });
    });
  });
});