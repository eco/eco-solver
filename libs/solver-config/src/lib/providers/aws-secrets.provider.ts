import { Injectable } from '@nestjs/common'
import { BaseConfigSource } from '../interfaces/config-source.interface'
import { AwsCredential } from '@libs/config-providers'

// Interface for AWS provider functionality (matches real provider signature)
interface AwsSecretsProvider {
  loadSecret(secretId: string): Promise<Record<string, unknown>>
}

@Injectable()
export class AwsSecretsConfigProvider extends BaseConfigSource {
  priority = 50 // Medium priority - external secrets
  name = 'AwsSecrets'

  constructor(
    private readonly awsProvider: AwsSecretsProvider,
    private readonly awsCredentials: AwsCredential[],
  ) {
    super()
  }

  async getConfig(): Promise<Record<string, unknown>> {
    if (!this.awsCredentials?.length) {
      return {}
    }

    try {
      const results = await Promise.allSettled(
        this.awsCredentials.map((cred) => this.awsProvider.loadSecret(cred.secretID)),
      )

      return results
        .filter(
          (result): result is PromiseFulfilledResult<Record<string, unknown>> =>
            result.status === 'fulfilled',
        )
        .reduce((acc, result) => ({ ...acc, ...result.value }), {})
    } catch (error) {
      return this.handleError(error, 'AWS Secrets Manager')
    }
  }
}
