import { SecretsManager } from '@aws-sdk/client-secrets-manager'
import { AwsCredentials } from './eco-config.types'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as config from 'config'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { ConfigSource } from './interfaces/config-source.interface'
import { EcoError } from '../common/errors/eco-error'

/**
 * Service to retrieve AWS secrets from AWS Secrets Manager
 */
@Injectable()
export class AwsConfigService implements OnModuleInit, ConfigSource {
  private logger = new Logger(AwsConfigService.name)
  private _awsConfigs: Record<string, string> = {}
  constructor() {}

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
  async initConfigs() {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Initializing aws configs`,
      }),
    )
    const awsCreds = config.get('aws') as AwsCredentials
    this._awsConfigs = await this.getAwsSecrets(awsCreds)
  }

  get awsConfigs(): Record<string, string> {
    return this._awsConfigs
  }

  /**
   * Retrieve the AWS secrets from the AWS Secrets Manager
   * @param awsCreds the aws credentials
   * @returns
   */
  private async getAwsSecrets(awsCreds: AwsCredentials): Promise<Record<string, string>> {
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
      this.logger.error(EcoError.getErrorMessage({ message: err.message }))
    }
    return {}
  }
}