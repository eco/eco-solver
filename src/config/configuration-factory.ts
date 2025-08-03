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
  solanaConfig 
} from '@/config/schemas';
import { AwsSecretsService } from '@/modules/config/services/aws-secrets.service';

/**
 * Configuration factory that combines all registered configurations
 * and optionally merges AWS secrets
 */
export const configurationFactory = async () => {
  // Build the base configuration from all registered configs
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

  const awsSecretsService = new AwsSecretsService();

  // If AWS Secrets Manager is not enabled, return the base configuration
  if (!baseConfiguration.aws.useAwsSecrets) {
    return baseConfiguration;
  }

  try {
    // Fetch secrets from AWS
    const secrets = await awsSecretsService.getSecrets(baseConfiguration.aws);

    // Merge secrets with base configuration
    const mergedConfig = awsSecretsService.mergeSecrets(baseConfiguration, secrets);

    // Validate the merged configuration with Zod
    const validatedConfig = ConfigSchema.parse(mergedConfig);

    return validatedConfig;
  } catch (error) {
    console.error('Failed to load AWS secrets, falling back to environment variables:', error);
    // Return base configuration if AWS Secrets Manager fails
    return baseConfiguration;
  }
};
