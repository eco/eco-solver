import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as config from 'config'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { ConfigSource } from './interfaces/config-source.interface'
import { downloadGitHubConfigs } from './utils/github-downloader.util'
import { GitConfig, GitApp } from './eco-config.types'

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

  async initConfigs(gitApp?: GitApp) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Initializing GitHub configs`,
      }),
    )

    try {
      const gitConfigs = config.get('gitConfig') as GitConfig
      if (!gitApp) {
        gitApp = config.get('gitApp') as GitApp
      }
      if (!gitConfigs || !gitApp) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'No git configs provided, skipping GitHub config initialization',
          }),
        )
        return
      }

      await this.loadConfigs(gitConfigs, gitApp)
    } catch (err) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to initialize GitHub configs: ${err.message}`,
        }),
      )
    }
  }

  async initConfigsFromGitConfig(gitApp: GitApp) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Initializing GitHub configs from provided git config`,
      }),
    )

    await this.initConfigs(gitApp)
  }

  private async loadConfigs(gitConfig: GitConfig, gitApp: GitApp) {
    this._githubConfigs = await downloadGitHubConfigs(gitConfig, gitApp, this.logger)
  }

  get githubConfigs(): Record<string, any> {
    return this._githubConfigs
  }
}
