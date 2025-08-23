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
