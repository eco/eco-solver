import { SecretsManager } from '@aws-sdk/client-secrets-manager'
import { AwsCredential } from './eco-config.types'
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common'
import * as config from 'config'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { ConfigSource } from './interfaces/config-source.interface'
import { EcoError } from '../common/errors/eco-error'
import { merge, mergeWith, isArray } from 'lodash'
import { GitHubConfigService } from './github-config.service'

/**
 * Service to retrieve AWS secrets from AWS Secrets Manager
 */
@Injectable()
export class AwsConfigService implements OnModuleInit, ConfigSource {
  private logger = new Logger(AwsConfigService.name)
  private _awsConfigs: Record<string, any> = {}
  constructor(@Optional() private readonly githubConfigService?: GitHubConfigService) {}

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

    // Check for git config in AWS secrets and merge if available
    if (this._awsConfigs.gitApp && this.githubConfigService) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Git config found in AWS secrets, using GitHubConfigService to fetch configs`,
        }),
      )

      await this.githubConfigService.initConfigsFromGitConfig(this._awsConfigs.gitApp)
      const gitConfigs = this.githubConfigService.getConfig()

      // Deep merge with git config taking priority (git as senior in conflicts)
      this._awsConfigs = mergeWith({}, this._awsConfigs, gitConfigs, (objValue, srcValue) => {
        if (isArray(objValue)) {
          return objValue.concat(srcValue)
        }
      })
    } else if (this._awsConfigs.githubApp && !this.githubConfigService) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `Git config found in AWS secrets but no GitHubConfigService available, skipping git config merge`,
        }),
      )
    }
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
      this.logger.error(EcoError.getErrorMessage({ message: err.message }))
      throw new EcoError(`Failed to retrieve AWS secrets: ${err.message}`)
    }
    return {}
  }
}
