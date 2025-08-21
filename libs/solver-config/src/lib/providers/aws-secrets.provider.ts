import { Injectable } from '@nestjs/common'
import { BaseConfigSource } from '../interfaces/config-source.interface'

@Injectable() 
export class AwsSecretsConfigProvider extends BaseConfigSource {
  priority = 50 // Medium priority - external secrets
  name = 'AwsSecrets'
  
  constructor(
    private readonly awsProvider: any,
    private readonly awsCredentials: any[]
  ) {
    super()
  }
  
  async getConfig(): Promise<Record<string, any>> {
    if (!this.awsCredentials?.length) {
      return {}
    }
    
    try {
      const results = await Promise.allSettled(
        this.awsCredentials.map(cred => 
          this.awsProvider.loadSecret(cred.secretID, cred.region)
        )
      )
      
      return results
        .filter((result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled')
        .reduce((acc, result) => ({ ...acc, ...result.value }), {})
    } catch (error) {
      return this.handleError(error, 'AWS Secrets Manager')
    }
  }
}