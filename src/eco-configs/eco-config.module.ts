import { DynamicModule, FactoryProvider, Global, Module, Provider } from '@nestjs/common'
import { EcoConfigService } from './eco-config.service'
import { AwsConfigService } from './aws-config.service'
import { GitHubConfigService } from './github-config.service'

@Global()
@Module({
  providers: [
    EcoConfigModule.createBaseProvider(),
    {
      provide: AwsConfigService,
      useFactory: (githubConfigService?: GitHubConfigService) =>
        new AwsConfigService(githubConfigService),
      inject: [{ token: GitHubConfigService, optional: true }],
    },
    GitHubConfigService,
  ],
  exports: [EcoConfigService, AwsConfigService, GitHubConfigService],
})
export class EcoConfigModule {
  static withAWS(includeGitHub = false): DynamicModule {
    return {
      global: true,
      module: EcoConfigModule,
      providers: EcoConfigModule.createAwsProvider(includeGitHub),
      exports: [EcoConfigService],
    }
  }

  static withGitHub(): DynamicModule {
    return {
      global: true,
      module: EcoConfigModule,
      providers: [EcoConfigModule.createGitHubProvider()],
      exports: [EcoConfigService],
    }
  }

  static withAll(): DynamicModule {
    return {
      global: true,
      module: EcoConfigModule,
      providers: EcoConfigModule.createAllProvider(),
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

  static createAwsProvider(includeGitHub = false): Provider[] {
    const providers: Provider[] = [
      {
        provide: EcoConfigService,
        useFactory: async (awsConfigService: AwsConfigService) => {
          await awsConfigService.initConfigs()
          return new EcoConfigService([awsConfigService])
        },
        inject: [AwsConfigService],
      },
    ]

    if (includeGitHub) {
      providers.unshift(GitHubConfigService, {
        provide: AwsConfigService,
        useFactory: (githubConfigService: GitHubConfigService) =>
          new AwsConfigService(githubConfigService),
        inject: [GitHubConfigService],
      })
    } else {
      providers.unshift({
        provide: AwsConfigService,
        useFactory: () => new AwsConfigService(),
        inject: [],
      })
    }

    return providers
  }

  static createGitHubProvider(): Provider {
    const dynamicConfig: FactoryProvider<EcoConfigService> = {
      provide: EcoConfigService,
      useFactory: async (githubConfigService: GitHubConfigService) => {
        await githubConfigService.initConfigs()
        return new EcoConfigService([githubConfigService])
      },
      inject: [GitHubConfigService],
    }
    return dynamicConfig
  }

  static createAllProvider(): Provider[] {
    return [
      {
        provide: AwsConfigService,
        useFactory: (githubConfigService: GitHubConfigService) =>
          new AwsConfigService(githubConfigService),
        inject: [GitHubConfigService],
      },
      GitHubConfigService,
      {
        provide: EcoConfigService,
        useFactory: async (
          awsConfigService: AwsConfigService,
          githubConfigService: GitHubConfigService,
        ) => {
          await Promise.all([awsConfigService.initConfigs(), githubConfigService.initConfigs()])
          return new EcoConfigService([awsConfigService, githubConfigService])
        },
        inject: [AwsConfigService, GitHubConfigService],
      },
    ]
  }

  static createBaseProvider(): Provider {
    return EcoConfigService
  }
}
