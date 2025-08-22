import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { Injectable, Logger, Inject } from '@nestjs/common'

export class ConfigurationLoadError extends Error {
  constructor(message: string, public cause?: any) {
    super(message)
    this.name = 'ConfigurationLoadError'
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack || cause.message || cause}`
    }
  }
}

@Injectable()
export class AwsSecretsProvider {
  private readonly client: SecretsManagerClient
  private readonly logger = new Logger(AwsSecretsProvider.name)

  constructor(
    @Inject('AWS_CREDENTIALS')
    private readonly awsConfig: {
      region: string
      accessKeyId?: string
      secretAccessKey?: string
    },
  ) {
    // Require injected AWS config - no defaults allowed
    if (!awsConfig?.region) {
      throw new Error('AWS region is required and must be injected - no defaults allowed')
    }

    this.client = new SecretsManagerClient({
      region: awsConfig.region,
      credentials: awsConfig.accessKeyId
        ? {
            accessKeyId: awsConfig.accessKeyId,
            secretAccessKey: awsConfig.secretAccessKey!,
          }
        : undefined,
    })

    this.logger.log(`AWS Secrets Provider initialized for region: ${awsConfig.region}`)
  }

  async loadSecret(secretId: string): Promise<Record<string, unknown>> {
    try {
      const command = new GetSecretValueCommand({ SecretId: secretId })
      const response = await this.client.send(command)

      if (!response.SecretString) {
        throw new Error(`No secret string found for ${secretId}`)
      }

      return JSON.parse(response.SecretString)
    } catch (error) {
      throw new ConfigurationLoadError(`Failed to load secret ${secretId}`, error)
    }
  }

  // Factory for dependency injection with required AWS config
  static forRootAsync(awsConfig: {
    region: string
    accessKeyId?: string
    secretAccessKey?: string
  }) {
    return {
      providers: [
        {
          provide: 'AWS_CREDENTIALS',
          useValue: awsConfig,
        },
        AwsSecretsProvider,
      ],
      exports: [AwsSecretsProvider],
    }
  }
}
