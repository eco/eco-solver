export interface ConfigSource {
  getConfig(): Promise<Record<string, any>>
  priority: number
  name: string
  enabled: boolean
}
export declare abstract class BaseConfigSource implements ConfigSource {
  abstract priority: number
  abstract name: string
  enabled: boolean
  abstract getConfig(): Promise<Record<string, any>>
  protected handleError(error: any, context: string): Record<string, any>
}
