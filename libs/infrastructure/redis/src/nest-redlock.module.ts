import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { NestRedlockConfig, NestRedlockDynamicConfig } from './nest-redlock.config'
import { NEST_REDLOCK_CONFIG } from './nest-redlock.config'
import { NestRedlockConfigFactoryTyped } from './nest-redlock.interface'
import { RedlockService } from './nest-redlock.service'

@Global()
@Module({
  imports: [],
  providers: [RedlockService],
  exports: [RedlockService],
})
export class RedlockModule {
  static forRoot(config: NestRedlockConfig): DynamicModule {
    return {
      module: RedlockModule,
      imports: [],
      providers: [
        {
          provide: NEST_REDLOCK_CONFIG,
          useValue: config,
        },
      ],
      exports: [],
    }
  }

  static forRootAsync(dynamicConfig: NestRedlockDynamicConfig): DynamicModule {
    const providers = this.createAsyncProviders(dynamicConfig)

    return {
      module: RedlockModule,
      imports: dynamicConfig.imports || [],
      providers,
      exports: [],
    }
  }

  static createAsyncProviders(dynamicConfig: NestRedlockDynamicConfig): Provider[] {
    if (dynamicConfig.useFactory) {
      return [
        {
          provide: NEST_REDLOCK_CONFIG,
          useFactory: dynamicConfig.useFactory,
          inject: dynamicConfig.inject,
        },
      ]
    }

    if (dynamicConfig.useClass || dynamicConfig.useExisting) {
      return [
        {
          provide: NEST_REDLOCK_CONFIG,
          useFactory: async (configFactory: NestRedlockConfigFactoryTyped) => {
            return await configFactory.createNestRedlockConfig()
          },
          inject: [dynamicConfig.useClass || dynamicConfig.useExisting!],
        },
      ]
    }

    return []
  }
}
