import { merge } from 'lodash';
import { z } from 'zod';

import { AwsSchema, BaseSchema, Config, ConfigSchema } from '@/config/config.schema';
import { getEcoNpmPackageConfig } from '@/config/utils/eco-package';
import { loadYamlConfig } from '@/config/utils/yaml-config-loader';
import { AwsSecretsService } from '@/modules/config/services/aws-secrets.service';
import { transformEnvVarsToConfig } from '@/modules/config/utils/schema-transformer';

let cachedConfig: Config;

/**
 * Configuration factory that transforms environment variables to configuration
 * and optionally merges AWS secrets and YAML configuration
 */
export const configurationFactory = async () => {
  if (cachedConfig) return cachedConfig;

  // Transform all environment variables to nested configuration
  const envConfiguration = transformEnvVarsToConfig(process.env, ConfigSchema);

  // First merge to get the configFiles path from env vars if specified
  let mergedConfig = merge({}, envConfiguration);

  // Load YAML configuration if files are specified
  const { configFiles } = BaseSchema.parse(mergedConfig);
  const yamlConfiguration = loadYamlConfig(configFiles);
  
  // Merge in order: base defaults, YAML config, then environment vars (env vars take precedence)
  mergedConfig = merge({}, yamlConfiguration, envConfiguration);

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

  try {
    // Parse and validate the complete merged configuration
    cachedConfig = ConfigSchema.parse(mergedConfig);
    return cachedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Convert Zod errors to a format similar to Joi
      const errorMessages = error.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return `${path}: ${issue.message}`;
        })
        .join(', ');

      throw new Error(`Configuration validation error: ${errorMessages}`);
    }
    throw error;
  }
};
