import {
  GetSecretValueCommand,
  SecretsManagerClient,
  SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import * as yaml from 'js-yaml';

import { getErrorMessage } from '@/common/utils/error-handler';
import { AwsConfig } from '@/config/schemas';
import { Logger } from '@/modules/logging';

export class AwsSecretsManager {
  private readonly logger: Logger;
  private secretsCache: Record<string, any> = {};

  constructor() {
    // Create Logger with default config
    this.logger = new Logger({ pinoHttp: { level: 'info' } });
    this.logger.setContext(AwsSecretsManager.name);
  }

  async getSecrets(awsConfig: AwsConfig): Promise<Record<string, any>> {
    if (!awsConfig.secretName) {
      this.logger.info('AWS Secrets Manager is disabled', { enabled: false });
      return {};
    }

    // Check cache first
    if (this.secretsCache[awsConfig.secretName]) {
      this.logger.info('Returning cached secrets', { secretName: awsConfig.secretName });
      return this.secretsCache[awsConfig.secretName];
    }

    try {
      const clientConfig: SecretsManagerClientConfig = {
        region: awsConfig.region,
      };

      // Only add credentials if provided
      if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        };
      }

      const client = new SecretsManagerClient(clientConfig);

      const command = new GetSecretValueCommand({
        SecretId: awsConfig.secretName,
      });

      const response = await client.send(command);

      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }

      // Try to parse the secret string - first as JSON, then as YAML
      let secrets: Record<string, any>;
      try {
        // First try JSON parsing (for backward compatibility)
        secrets = JSON.parse(response.SecretString);
        this.logger.info('Successfully parsed secrets as JSON from AWS Secrets Manager', {
          secretName: awsConfig.secretName,
        });
      } catch (jsonError) {
        // If JSON parsing fails, try YAML parsing
        try {
          secrets = yaml.load(response.SecretString) as Record<string, any>;
          this.logger.info('Successfully parsed secrets as YAML from AWS Secrets Manager', {
            secretName: awsConfig.secretName,
          });
        } catch (yamlError) {
          throw new Error(
            `Failed to parse secrets from AWS Secrets Manager as JSON or YAML. ` +
              `JSON error: ${getErrorMessage(jsonError)}. ` +
              `YAML error: ${getErrorMessage(yamlError)}`,
          );
        }
      }

      // Validate that the parsed result is an object
      if (!secrets || typeof secrets !== 'object') {
        throw new Error('Parsed secrets must be an object');
      }

      // Cache the secrets
      this.secretsCache[awsConfig.secretName] = secrets;

      this.logger.info('Successfully fetched secrets from AWS Secrets Manager', {
        secretName: awsConfig.secretName,
      });

      return secrets;
    } catch (error) {
      this.logger.error('Failed to fetch secrets from AWS Secrets Manager', error, {
        secretName: awsConfig.secretName,
      });
      throw error;
    }
  }
}
