import { Injectable, Logger } from '@nestjs/common';

import {
  GetSecretValueCommand,
  SecretsManagerClient,
  SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import { z } from 'zod';

import { AwsSchema } from '@/config/config.schema';

type AwsConfig = z.infer<typeof AwsSchema>;

@Injectable()
export class AwsSecretsService {
  private readonly logger = new Logger(AwsSecretsService.name);
  private secretsCache: Record<string, any> = {};

  async getSecrets(awsConfig: AwsConfig): Promise<Record<string, any>> {
    if (!awsConfig.useAwsSecrets) {
      this.logger.log('AWS Secrets Manager is disabled');
      return {};
    }

    // Check cache first
    if (this.secretsCache[awsConfig.secretName]) {
      this.logger.log('Returning cached secrets');
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

      // Parse the JSON string
      const secrets = JSON.parse(response.SecretString);

      // Cache the secrets
      this.secretsCache[awsConfig.secretName] = secrets;

      this.logger.log(
        `Successfully fetched secrets from AWS Secrets Manager: ${awsConfig.secretName}`,
      );

      return secrets;
    } catch (error) {
      this.logger.error(`Failed to fetch secrets from AWS Secrets Manager: ${error.message}`);
      throw error;
    }
  }
}
