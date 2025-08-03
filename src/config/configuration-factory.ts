import { merge } from 'lodash';

import { AwsSchema, ConfigSchema } from '@/config/config.schema';
import {
  awsConfig,
  baseConfig,
  evmConfig,
  fulfillmentConfig,
  mongodbConfig,
  proversConfig,
  queueConfig,
  redisConfig,
  solanaConfig,
} from '@/config/schemas';
import { AwsSecretsService } from '@/modules/config/services/aws-secrets.service';
import { transformEnvVarsToConfig } from '@/modules/config/utils/schema-transformer';

/**
 * Configuration factory that transforms environment variables to configuration
 * and optionally merges AWS secrets
 */
export const configurationFactory = async () => {
  const baseConfiguration = {
    ...baseConfig(),
    mongodb: await mongodbConfig(),
    redis: await redisConfig(),
    evm: await evmConfig(),
    solana: await solanaConfig(),
    queue: await queueConfig(),
    aws: await awsConfig(),
    provers: await proversConfig(),
    fulfillment: await fulfillmentConfig(),
  };

  // Transform all environment variables to nested configuration
  const envConfiguration = transformEnvVarsToConfig(process.env, ConfigSchema);

  // Merge base defaults with environment configuration
  let mergedConfig = merge({}, baseConfiguration, envConfiguration);

  // Check if AWS secrets should be loaded
  const useAwsSecrets = Boolean(mergedConfig.aws?.secretName);

  if (useAwsSecrets) {
    try {
      const awsSecretsService = new AwsSecretsService();

      const awsConfig = AwsSchema.parse(mergedConfig.aws);

      // Fetch secrets from AWS using the merged config
      const secrets = await awsSecretsService.getSecrets(awsConfig);

      // Transform flat secrets to nested configuration structure using schema
      const nestedSecrets = transformEnvVarsToConfig(secrets, ConfigSchema);

      // Merge AWS secrets into the configuration
      mergedConfig = merge({}, mergedConfig, nestedSecrets);
    } catch (error) {
      console.error('Failed to load AWS secrets:', error);
      throw error;
    }
  }

  // Parse and validate the complete merged configuration
  return ConfigSchema.parse(mergedConfig);
};
