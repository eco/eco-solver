import { Logger } from '@nestjs/common';

import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import * as yaml from 'js-yaml';

import { AwsConfig } from '@/config/schemas';

import { AwsSecretsService } from '../aws-secrets.service';

jest.mock('@aws-sdk/client-secrets-manager');

describe('AwsSecretsService', () => {
  let service: AwsSecretsService;
  let mockSecretsManagerClient: jest.MockedObjectDeep<SecretsManagerClient>;

  beforeEach(() => {
    service = new AwsSecretsService();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    mockSecretsManagerClient = new SecretsManagerClient(
      {},
    ) as jest.MockedObjectDeep<SecretsManagerClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSecrets', () => {
    const mockAwsConfig: AwsConfig = {
      region: 'us-east-1',
      secretName: 'test-secret',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret-key',
    };

    it('should return empty object when secretName is not provided', async () => {
      const configWithoutSecret: AwsConfig = {
        ...mockAwsConfig,
        secretName: undefined,
      };

      const result = await service.getSecrets(configWithoutSecret);

      expect(result).toEqual({});
      expect(Logger.prototype.log).toHaveBeenCalledWith('AWS Secrets Manager is disabled');
    });

    it('should successfully parse JSON secrets', async () => {
      const mockJsonSecrets = {
        database: 'mongodb://localhost',
        apiKey: 'test-api-key',
      };
      const mockSecretString = JSON.stringify(mockJsonSecrets);

      mockSecretsManagerClient.send = jest.fn().mockResolvedValue({
        SecretString: mockSecretString,
      });
      (SecretsManagerClient as jest.MockedClass<typeof SecretsManagerClient>).mockImplementation(
        () => mockSecretsManagerClient as any,
      );

      const result = await service.getSecrets(mockAwsConfig);

      expect(result).toEqual(mockJsonSecrets);
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Successfully parsed secrets as JSON'),
      );
    });

    it('should successfully parse YAML secrets when JSON parsing fails', async () => {
      const mockYamlSecrets = {
        database: 'mongodb://localhost',
        apiKey: 'test-api-key',
        nested: {
          value: 123,
        },
      };
      const mockSecretString = yaml.dump(mockYamlSecrets);

      mockSecretsManagerClient.send = jest.fn().mockResolvedValue({
        SecretString: mockSecretString,
      });
      (SecretsManagerClient as jest.MockedClass<typeof SecretsManagerClient>).mockImplementation(
        () => mockSecretsManagerClient as any,
      );

      const result = await service.getSecrets(mockAwsConfig);

      expect(result).toEqual(mockYamlSecrets);
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Successfully parsed secrets as YAML'),
      );
    });

    it('should throw error when both JSON and YAML parsing fail', async () => {
      const invalidSecretString = 'not valid json or yaml: {]}';

      mockSecretsManagerClient.send = jest.fn().mockResolvedValue({
        SecretString: invalidSecretString,
      });
      (SecretsManagerClient as jest.MockedClass<typeof SecretsManagerClient>).mockImplementation(
        () => mockSecretsManagerClient as any,
      );

      await expect(service.getSecrets(mockAwsConfig)).rejects.toThrow(
        'Failed to parse secrets from AWS Secrets Manager as JSON or YAML',
      );
    });

    it('should throw error when parsed result is not an object', async () => {
      const mockSecretString = '"just a string"';

      mockSecretsManagerClient.send = jest.fn().mockResolvedValue({
        SecretString: mockSecretString,
      });
      (SecretsManagerClient as jest.MockedClass<typeof SecretsManagerClient>).mockImplementation(
        () => mockSecretsManagerClient as any,
      );

      await expect(service.getSecrets(mockAwsConfig)).rejects.toThrow(
        'Parsed secrets must be an object',
      );
    });

    it('should throw error when secret value is empty', async () => {
      mockSecretsManagerClient.send = jest.fn().mockResolvedValue({
        SecretString: null,
      });
      (SecretsManagerClient as jest.MockedClass<typeof SecretsManagerClient>).mockImplementation(
        () => mockSecretsManagerClient as any,
      );

      await expect(service.getSecrets(mockAwsConfig)).rejects.toThrow('Secret value is empty');
    });

    it('should cache secrets and return cached value on subsequent calls', async () => {
      const mockJsonSecrets = { cached: 'value' };
      const mockSecretString = JSON.stringify(mockJsonSecrets);

      mockSecretsManagerClient.send = jest.fn().mockResolvedValue({
        SecretString: mockSecretString,
      });
      (SecretsManagerClient as jest.MockedClass<typeof SecretsManagerClient>).mockImplementation(
        () => mockSecretsManagerClient as any,
      );

      // First call
      const result1 = await service.getSecrets(mockAwsConfig);
      expect(result1).toEqual(mockJsonSecrets);

      // Second call should return cached value
      const result2 = await service.getSecrets(mockAwsConfig);
      expect(result2).toEqual(mockJsonSecrets);
      expect(Logger.prototype.log).toHaveBeenCalledWith('Returning cached secrets');
      // SecretsManagerClient should only be called once due to caching
      expect(mockSecretsManagerClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
