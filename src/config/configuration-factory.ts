import { ConfigSchema } from '@/config/config.schema';
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
import { merge } from 'lodash';

/**
 * Configuration factory that transforms environment variables to configuration
 * and optionally merges AWS secrets
 */
export const configurationFactory = async () => {
  const baseConfiguration = {
    ...baseConfig(),
    mongodb: mongodbConfig(),
    redis: redisConfig(),
    evm: evmConfig(),
    solana: solanaConfig(),
    queue: queueConfig(),
    aws: awsConfig(),
    provers: proversConfig(),
    fulfillment: fulfillmentConfig(),
  };

  // Transform all environment variables to nested configuration
  const envConfiguration = transformEnvVarsToConfig(process.env, ConfigSchema);

  // Parse with Zod to apply defaults and validation
  const parsedConfig = ConfigSchema.parse(envConfiguration);

  const awsSecretsService = new AwsSecretsService();

  // If AWS Secrets Manager is not enabled, return the parsed configuration
  if (!parsedConfig.aws.useAwsSecrets) {
    return merge({}, baseConfiguration, envConfiguration);
  }

  try {
    // Fetch secrets from AWS
    const secrets = await awsSecretsService.getSecrets(parsedConfig.aws);

    // Transform flat secrets to nested configuration structure using schema
    const nestedSecrets = transformEnvVarsToConfig(secrets, ConfigSchema);

    const awsConfiguration = ConfigSchema.parse(nestedSecrets);

    return merge({}, baseConfiguration, envConfiguration, awsConfiguration);
  } catch (error) {
    console.error('Failed to load AWS secrets, falling back to environment variables:', error);
    // Return parsed configuration if AWS Secrets Manager fails
    return parsedConfig;
  }
};
