import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { Injectable, Logger, Inject } from '@nestjs/common'

// Interface for AWS credentials configuration
export interface AwsCredential {
  secretID: string
  region: string
}

// Interface for AWS provider functionality (matches real provider signature)
export interface IAwsSecretsProvider {
  loadSecret(secretId: string): Promise<Record<string, unknown>>
}

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
  private readonly clients: Map<string, SecretsManagerClient> = new Map()
  private readonly logger = new Logger(AwsSecretsProvider.name)

  constructor(
    @Inject('AWS_CREDENTIALS')
    private readonly awsCredentials: AwsCredential[],
  ) {
    // Require injected AWS credentials - no defaults allowed
    if (!awsCredentials?.length) {
      throw new Error('AWS credentials are required and must be injected - no defaults allowed')
    }

    // Initialize clients for each unique region
    const uniqueRegions = [...new Set(awsCredentials.map((cred) => cred.region))]
    uniqueRegions.forEach((region) => {
      this.clients.set(region, new SecretsManagerClient({ region }))
    })
  }

  async loadSecret(secretId: string): Promise<Record<string, unknown>> {
    // Find the credential that matches this secretId
    const credential = this.awsCredentials.find((cred) => cred.secretID === secretId)
    if (!credential) {
      throw new ConfigurationLoadError(`No credential configuration found for secret ${secretId}`)
    }

    const client = this.clients.get(credential.region)
    if (!client) {
      throw new ConfigurationLoadError(`No AWS client found for region ${credential.region}`)
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretId })
      const response = await client.send(command)

      if (!response.SecretString) {
        throw new Error(`No secret string found for ${secretId}`)
      }

      return JSON.parse(response.SecretString)
    } catch (error) {
      throw new ConfigurationLoadError(
        `Failed to load secret ${secretId} from region ${credential.region}`,
        error,
      )
    }
  }

  // Factory for dependency injection with required AWS credentials
  static forRootAsync(awsCredentials: AwsCredential[]) {
    return {
      providers: [
        {
          provide: 'AWS_CREDENTIALS',
          useValue: awsCredentials,
        },
        AwsSecretsProvider,
      ],
      exports: [AwsSecretsProvider],
    }
  }
}
