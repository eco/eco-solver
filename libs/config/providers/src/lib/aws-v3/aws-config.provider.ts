import { registerAs } from '@nestjs/config'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { AwsConfigSchema } from '@libs/config-schemas'

export default registerAs('aws', () => {
  const config = {
    region: process.env['AWS_REGION'] || 'us-east-1',
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
    secretsManager: {
      enabled: process.env['AWS_SECRETS_ENABLED'] === 'true',
      secrets: process.env['AWS_SECRETS_LIST']?.split(',') || [
        'eco-solver/database',
        'eco-solver/redis',
        'eco-solver/auth',
      ],
    },
  }

  // Validate with Zod and get strongly-typed result
  return AwsConfigSchema.parse(config)
})

// Helper function to load a single secret
export const loadSecret = async (
  client: SecretsManagerClient,
  secretId: string,
): Promise<Record<string, unknown>> => {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretId })
    const response = await client.send(command)

    if (!response.SecretString) {
      throw new Error(`No secret string found for ${secretId}`)
    }

    return JSON.parse(response.SecretString)
  } catch (error) {
    console.warn(
      `Failed to load secret ${secretId}:`,
      error instanceof Error ? error.message : error,
    )
    return {}
  }
}

// Async factory for secret loading - handles partial failures gracefully
export const createAwsSecretsFactory = () => ({
  useFactory: async (): Promise<Record<string, unknown>> => {
    const awsRegion = process.env['AWS_REGION'] || 'us-east-1'
    const secretsEnabled = process.env['AWS_SECRETS_ENABLED'] === 'true'

    if (!secretsEnabled) {
      console.log('AWS Secrets Manager disabled - skipping secret loading')
      return {}
    }

    const client = new SecretsManagerClient({
      region: awsRegion,
      credentials: process.env['AWS_ACCESS_KEY_ID']
        ? {
            accessKeyId: process.env['AWS_ACCESS_KEY_ID']!,
            secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY']!,
          }
        : undefined,
    })

    const secretIds = process.env['AWS_SECRETS_LIST']?.split(',') || [
      'eco-solver/database',
      'eco-solver/redis',
      'eco-solver/auth',
    ]

    const secrets = await Promise.allSettled(
      secretIds.map((secretId) => loadSecret(client, secretId)),
    )

    // Handle partial failures gracefully - collect successful secrets
    const config = {}
    secrets.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        Object.assign(config, result.value)
      } else {
        console.warn(`Failed to load secret ${secretIds[index]}:`, result.reason)
      }
    })

    console.log(`AWS Secrets loaded successfully: ${Object.keys(config).length} secret(s)`)
    return config
  },
})
