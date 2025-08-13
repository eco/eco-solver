import { NestRedlockConfig } from './nest-redlock.config'
import { NestRedlockConfigFactory } from './types'

// Re-export the factory interface with proper typing
export interface NestRedlockConfigFactoryTyped extends NestRedlockConfigFactory {
  createNestRedlockConfig(): Promise<NestRedlockConfig> | NestRedlockConfig
}
