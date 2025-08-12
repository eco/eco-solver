import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as config from 'config'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { ConfigSource } from './interfaces/config-source.interface'
import { mergeWith, isArray } from 'lodash'

interface GitConfig {
  repo: string
  hash: string
  env: string
  token?: string
}

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

    const configs = await Promise.all(
      gitConfigs.map(async (gitConfig: GitConfig) => {
        return await this.downloadGitHubConfigs(gitConfig)
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

  private async downloadGitHubConfigs(gitConfig: GitConfig): Promise<Record<string, any>> {
    try {
      const { repo, hash, env, token } = gitConfig
      const assetsPath = `assets/${env}`

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Downloading configs from ${repo}@${hash}/${assetsPath}`,
        }),
      )

      // Get the directory contents first
      const contentsUrl = `https://api.github.com/repos/${repo}/contents/${assetsPath}?ref=${hash}`
      const headers: HeadersInit = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'eco-solver-config-service',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const contentsResponse = await fetch(contentsUrl, { headers })
      if (!contentsResponse.ok) {
        throw new Error(`Failed to get directory contents: HTTP ${contentsResponse.status}`)
      }

      const contents = (await contentsResponse.json()) as Array<{
        name: string
        type: string
        download_url: string
      }>

      // Filter for JSON files only
      const jsonFiles = contents.filter(
        (file) => file.type === 'file' && file.name.endsWith('.json'),
      )

      if (jsonFiles.length === 0) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: `No JSON files found in ${repo}@${hash}/${assetsPath}`,
          }),
        )
        return {}
      }

      // Download all JSON files in parallel
      const configPromises = jsonFiles.map(async (file) => {
        try {
          const fileResponse = await fetch(file.download_url)
          if (!fileResponse.ok) {
            throw new Error(`Failed to download ${file.name}: HTTP ${fileResponse.status}`)
          }
          return await fileResponse.json()
        } catch (error) {
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: `Failed to download ${file.name}: ${error.message}`,
            }),
          )
          return {}
        }
      })

      const configResults = await Promise.all(configPromises)
      const mergedConfig = configResults.reduce((acc, config) => ({ ...acc, ...config }), {})

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Successfully downloaded ${jsonFiles.length} config files from ${repo}@${hash}/${assetsPath}`,
        }),
      )

      return mergedConfig
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to download GitHub configs from ${gitConfig.repo}: ${error.message}`,
        }),
      )
      return {}
    }
  }
}
