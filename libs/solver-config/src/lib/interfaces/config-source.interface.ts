export interface ConfigSource {
  getConfig(): Promise<Record<string, unknown>>
  priority: number // Lower = higher priority (0 = highest)
  name: string // For logging/debugging
  enabled: boolean // Allow dynamic enable/disable
}

export abstract class BaseConfigSource implements ConfigSource {
  abstract priority: number
  abstract name: string

  enabled = true

  abstract getConfig(): Promise<Record<string, unknown>>

  protected handleError(error: unknown, context: string): Record<string, unknown> {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[${this.name}] Failed to load config from ${context}:`, message)
    return {} // Return empty config on failure
  }
}
