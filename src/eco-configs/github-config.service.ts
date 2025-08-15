import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as config from 'config'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { ConfigSource } from './interfaces/config-source.interface'
import { mergeWith, isArray } from 'lodash'
import { downloadGitHubConfigs } from './utils/github-downloader.util'
import { GitConfig } from './eco-config.types'

@Injectable()
export class GitHubConfigService implements OnModuleInit, ConfigSource {
  private logger = new Logger(GitHubConfigService.name)
  private _githubConfigs: Record<string, any> = {}

  constructor() {}

  async onModuleInit() {
    await this.initConfigs()
  }

  getConfig() {
    return this.githubConfigs
  }

  async initConfigs() {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Initializing GitHub configs`,
      }),
    )

    const gitConfigs = config.get('git') as GitConfig[]
    if (!Array.isArray(gitConfigs) || gitConfigs.length === 0) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'No git configs provided, skipping GitHub config initialization',
        }),
      )
      return
    }

    await this.loadConfigs(gitConfigs)
  }

  async initConfigsFromGitConfig(gitConfig: any) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Initializing GitHub configs from provided git config`,
      }),
    )

    const gitConfigs = Array.isArray(gitConfig) ? gitConfig : [gitConfig]
    await this.loadConfigs(gitConfigs)
  }

  private async loadConfigs(gitConfigs: GitConfig[]) {
    const configs = await Promise.all(
      gitConfigs.map(async (gitConfig: GitConfig) => {
        return await downloadGitHubConfigs(gitConfig, this.logger)
      }),
    )

    // Deep merge all configs with custom array handling
    this._githubConfigs = configs.reduce((acc, config) => {
      return mergeWith(acc, config, (objValue, srcValue) => {
        if (isArray(objValue)) {
          return objValue.concat(srcValue)
        }
      })
    }, {})
  }

  get githubConfigs(): Record<string, any> {
    return this._githubConfigs
  }
}
