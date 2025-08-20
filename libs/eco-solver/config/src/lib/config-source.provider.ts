import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from './eco-config.service'

export interface ConfigSource {
  getConfig(): Promise<Record<string, any>>
}

@Injectable()
export class AwsConfigSourceProvider implements ConfigSource {
  private readonly logger = new Logger(AwsConfigSourceProvider.name)

  constructor(private configService: EcoConfigService) {}

  async getConfig(): Promise<Record<string, any>> {
    try {
      // This is a placeholder for AWS Secrets Manager integration
      // The actual AWS integration from the original eco-solver should be migrated here
      // when AWS services are copied over to the Nx monorepo

      this.logger.debug('AWS Config Source Provider called - placeholder implementation')

      return {}
    } catch (error) {
      this.logger.error('Failed to fetch config from AWS:', error)
      return {}
    }
  }
}

@Injectable()
export class ConfigSourceProvider {
  private readonly logger = new Logger(ConfigSourceProvider.name)
  private configSources: ConfigSource[] = []

  addConfigSource(source: ConfigSource): void {
    this.configSources.push(source)
  }

  async loadAllConfigs(): Promise<Record<string, any>> {
    let mergedConfig: Record<string, any> = {}

    for (const source of this.configSources) {
      try {
        const config = await source.getConfig()
        mergedConfig = { ...mergedConfig, ...config }
      } catch (error) {
        this.logger.error(`Failed to load config from source ${source.constructor.name}:`, error)
      }
    }

    return mergedConfig
  }

  getConfigSources(): ConfigSource[] {
    return this.configSources
  }
}
