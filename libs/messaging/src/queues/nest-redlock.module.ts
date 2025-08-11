import { Global, Module, DynamicModule, Provider } from '@nestjs/common'
import { RedlockService } from './nest-redlock.service'
import { NEST_REDLOCK_CONFIG, NestRedlockConfig, NestRedlockDynamicConfig, NestRedlockConfigFactory } from './nest-redlock.interface'

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
          useFactory: async (configFactory: NestRedlockConfigFactory) => {
            return await configFactory.createNestRedlockConfig()
          },
          inject: [dynamicConfig.useClass || dynamicConfig.useExisting!],
        },
      ]
    }

    return []
  }
}
