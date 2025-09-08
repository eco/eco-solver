import { SecretsManager } from '@aws-sdk/client-secrets-manager'
import { AwsCredential } from './eco-config.types'
import { Injectable, OnModuleInit } from '@nestjs/common'
import * as config from 'config'
import { ConfigSource } from './interfaces/config-source.interface'
import { merge } from 'lodash'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation } from '@/common/logging/decorators'

/**
 * Service to retrieve AWS secrets from AWS Secrets Manager
 */
@Injectable()
export class AwsConfigService implements OnModuleInit, ConfigSource {
  private logger = new GenericOperationLogger('AwsConfigService')
  private _awsConfigs: Record<string, string> = {}
  constructor() {}

  @LogOperation('config_operation', GenericOperationLogger)
  async onModuleInit() {
    await this.initConfigs()
  }

  /**
   * @returns the aws configs
   */
  getConfig() {
    return this.awsConfigs
  }

  /**
   * Initialize the configs
   */
  @LogOperation('config_operation', GenericOperationLogger)
  async initConfigs() {
    this.logger.debug(
      {
        operationType: 'config_operation',
        status: 'started',
      },
      'Initializing AWS configs',
    )
    let awsCreds = config.get('aws') as any[]
    if (!Array.isArray(awsCreds)) {
      awsCreds = [awsCreds]
    }
    const creds = await Promise.all(
      awsCreds.map(async (cred: AwsCredential) => {
        return await this.getAwsSecrets(cred)
      }),
    )
    merge(this._awsConfigs, ...creds)
  }

  get awsConfigs(): Record<string, string> {
    return this._awsConfigs
  }

  /**
   * Retrieve the AWS secrets from the AWS Secrets Manager
   * @param awsCreds the aws credentials
   * @returns
   */
  private async getAwsSecrets(awsCreds: AwsCredential): Promise<Record<string, string>> {
    const secretsManager = new SecretsManager({
      region: awsCreds.region,
    })
    try {
      const data = await secretsManager.getSecretValue({ SecretId: awsCreds.secretID })
      if (data.SecretString) {
        const secret = JSON.parse(data.SecretString)
        return secret as Record<string, string>
      }
    } catch (err) {
      this.logger.error(
        {
          operationType: 'config_operation',
          status: 'failed',
        },
        'Failed to retrieve AWS secrets',
        err,
        {
          region: awsCreds.region,
          secretID: awsCreds.secretID,
        },
      )
    }
    return {}
  }
}
