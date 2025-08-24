import { Injectable } from '@nestjs/common'
import { BaseConfigSource } from '../interfaces/config-source.interface'
import { AwsCredential, IAwsSecretsProvider } from '@libs/config-providers'

@Injectable()
export class AwsSecretsConfigProvider extends BaseConfigSource {
  priority = 50 // Medium priority - external secrets
  name = 'AwsSecrets'

  constructor(
    private readonly awsProvider: IAwsSecretsProvider,
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
