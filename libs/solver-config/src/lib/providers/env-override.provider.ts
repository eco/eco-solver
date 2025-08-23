import { Injectable } from '@nestjs/common'
import { BaseConfigSource } from '../interfaces/config-source.interface'

@Injectable()
export class EnvOverrideProvider extends BaseConfigSource {
  priority = 10 // High priority - environment overrides
  name = 'EnvOverride'

  async getConfig(): Promise<Record<string, unknown>> {
    // Parse environment variables with ECO_CONFIG_ prefix
    const envConfig: Record<string, unknown> = {}

    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('ECO_CONFIG_')) {
        const configKey = key.replace('ECO_CONFIG_', '').toLowerCase()
        const value = process.env[key]

        try {
          // Try to parse as JSON, fallback to string
          envConfig[configKey] = JSON.parse(value!)
        } catch {
          envConfig[configKey] = value
        }
      }
    })

    return envConfig
  }
}
