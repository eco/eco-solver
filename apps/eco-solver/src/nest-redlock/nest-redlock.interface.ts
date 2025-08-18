import { NestRedlockConfig } from './nest-redlock.config'

export interface NestRedlockConfigFactory {
  createNestRedlockConfig(): Promise<NestRedlockConfig> | NestRedlockConfig
}
