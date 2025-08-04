import { merge } from 'lodash';

import { AwsSchema, BaseSchema, ConfigSchema } from '@/config/config.schema';
import {
  awsConfig,
  baseConfig,
  evmConfig,
  fulfillmentConfig,
  mongodbConfig,
  queueConfig,
  redisConfig,
  solanaConfig,
} from '@/config/schemas';
import { getEcoNpmPackageConfig } from '@/config/utils/eco-package';
import { loadYamlConfig } from '@/config/utils/yaml-config-loader';
import { AwsSecretsService } from '@/modules/config/services/aws-secrets.service';
import { transformEnvVarsToConfig } from '@/modules/config/utils/schema-transformer';

/**
 * Configuration factory that transforms environment variables to configuration
 * and optionally merges AWS secrets and YAML configuration
 */
export const configurationFactory = async () => {
  const baseConfiguration = {
    ...(await baseConfig()),
    mongodb: await mongodbConfig(),
    redis: await redisConfig(),
    evm: await evmConfig(),
    solana: await solanaConfig(),
    queue: await queueConfig(),
    aws: await awsConfig(),
    fulfillment: await fulfillmentConfig(),
  };

  // Transform all environment variables to nested configuration
  const envConfiguration = transformEnvVarsToConfig(process.env, ConfigSchema);

  // First merge to get the configFiles path from env vars if specified
  let mergedConfig = merge({}, baseConfiguration, envConfiguration);

  // Load YAML configuration if files are specified
  const { configFiles } = BaseSchema.parse(mergedConfig);
  const yamlConfiguration = loadYamlConfig(configFiles);

  // Merge in order: base defaults, YAML config, then environment vars
  mergedConfig = merge({}, baseConfiguration, yamlConfiguration, envConfiguration);

  // Check if AWS secrets should be loaded
  const useAwsSecrets = Boolean(mergedConfig.aws?.secretName);

  if (useAwsSecrets) {
    const awsSecretsService = new AwsSecretsService();

    const awsConfig = AwsSchema.parse(mergedConfig.aws);

    // Fetch secrets from AWS using the merged config
    const secrets = await awsSecretsService.getSecrets(awsConfig);

    // Transform flat secrets to nested configuration structure using schema
    const nestedSecrets = transformEnvVarsToConfig(secrets, ConfigSchema);

    // Merge AWS secrets into the configuration
    mergedConfig = merge({}, mergedConfig, nestedSecrets);
  }

  if (!mergedConfig.skipEcoPackageConfig) {
    const npmPackageConfig = getEcoNpmPackageConfig(mergedConfig);

    mergedConfig = merge({}, mergedConfig, npmPackageConfig);
  }

  // Parse and validate the complete merged configuration
  return ConfigSchema.parse(mergedConfig);
};
