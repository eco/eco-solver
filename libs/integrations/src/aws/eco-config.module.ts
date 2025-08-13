import { Global, Module, DynamicModule, Provider, FactoryProvider } from '@nestjs/common'
import { EcoConfigService } from './eco-config.service'
import { AwsConfigService } from './aws-config.service'

@Global()
@Module({
  providers: [EcoConfigModule.createBaseProvider(), AwsConfigService],
  exports: [EcoConfigService, AwsConfigService],
})
export class EcoConfigModule {
  static withAWS(): DynamicModule {
    return {
      global: true,
      module: EcoConfigModule,
      providers: [EcoConfigModule.createAwsProvider()],
      exports: [EcoConfigService],
    }
  }

  static base(): DynamicModule {
    return {
      global: true,
      module: EcoConfigModule,
      providers: [EcoConfigModule.createBaseProvider()],
      exports: [EcoConfigService],
    }
  }

  static createAwsProvider(): Provider {
    const dynamicConfig: FactoryProvider<EcoConfigService> = {
      provide: EcoConfigService,
      useFactory: async (awsConfigService: AwsConfigService) => {
        await awsConfigService.initConfigs()
        return new EcoConfigService([awsConfigService])
      },
      inject: [AwsConfigService],
    }
    return dynamicConfig
  }

  static createBaseProvider(): Provider {
    return EcoConfigService
  }
}
