import { ConfigSchema } from '@/config/config.schema';
import { configuration } from '@/config/configuration';
import { AwsSecretsService } from '@/modules/config/services/aws-secrets.service';

export const configurationFactory = async () => {
  const baseConfig = configuration();
  const awsSecretsService = new AwsSecretsService();

  // If AWS Secrets Manager is not enabled, return the base configuration
  if (!baseConfig.aws.useAwsSecrets) {
    return baseConfig;
  }

  try {
    // Fetch secrets from AWS
    const secrets = await awsSecretsService.getSecrets(baseConfig.aws);

    // Merge secrets with base configuration
    const mergedConfig = awsSecretsService.mergeSecrets(baseConfig, secrets);

    // Validate the merged configuration with Zod
    const validatedConfig = ConfigSchema.parse(mergedConfig);

    return validatedConfig;
  } catch (error) {
    console.error('Failed to load AWS secrets, falling back to environment variables:', error);
    // Return base configuration if AWS Secrets Manager fails
    return baseConfig;
  }
};
