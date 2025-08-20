import { ModuleMetadata, Type } from '@nestjs/common'
import { NestRedlockConfigFactory } from './nest-redlock.interface'
import { RedisConfig } from '../eco-configs/eco-config.types'

export type NestRedlockConfig = RedisConfig

export interface NestRedlockDynamicConfig extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (...args: any[]) => Promise<NestRedlockConfig> | NestRedlockConfig
  useClass?: Type<NestRedlockConfigFactory>
  useExisting?: Type<NestRedlockConfigFactory>
  inject?: any[]
}

export const NEST_REDLOCK_CONFIG = 'NEST_REDLOCK_CONFIG'
