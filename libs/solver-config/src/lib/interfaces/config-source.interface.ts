export interface ConfigSource {
  getConfig(): Promise<Record<string, any>>
  priority: number // Lower = higher priority (0 = highest)
  name: string // For logging/debugging
  enabled: boolean // Allow dynamic enable/disable
}

export abstract class BaseConfigSource implements ConfigSource {
  abstract priority: number
  abstract name: string

  enabled = true

  abstract getConfig(): Promise<Record<string, any>>

  protected handleError(error: any, context: string): Record<string, any> {
    console.warn(`[${this.name}] Failed to load config from ${context}:`, error.message)
    return {} // Return empty config on failure
  }
}
