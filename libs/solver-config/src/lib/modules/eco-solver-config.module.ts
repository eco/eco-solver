import { DynamicModule, Module, Provider } from '@nestjs/common'
import { EcoSolverConfigService } from '../services/eco-solver-config.service'
import { StaticConfigProvider } from '../providers/static-config.provider'
import { AwsSecretsConfigProvider } from '../providers/aws-secrets.provider'
import { EnvOverrideProvider } from '../providers/env-override.provider'
import { getStaticSolverConfig } from '../solver-config'

export interface EcoSolverConfigOptions {
  enableAws?: boolean
  enableEnvOverrides?: boolean
  awsRegion?: string
  customProviders?: Provider[]
}

@Module({})
export class EcoSolverConfigModule {
  static forRoot(options: EcoSolverConfigOptions = {}): DynamicModule {
    // 1. Analyze static config to determine what providers are needed
    const staticConfig = getStaticSolverConfig()
    const needsAws = staticConfig.aws?.length > 0 || options.enableAws

    // 2. Build provider array based on analysis
    const providers: Provider[] = [
      // Always include static config provider
      StaticConfigProvider,

      // Core service that receives the providers
      {
        provide: EcoSolverConfigService,
        useFactory: async (...configSources: any[]) => {
          const service = new EcoSolverConfigService(configSources)
          await service.initializeConfig()
          return service
        },
        inject: [
          StaticConfigProvider,
          ...(needsAws ? [AwsSecretsConfigProvider] : []),
          ...(options.enableEnvOverrides ? [EnvOverrideProvider] : []),
        ],
      },
    ]

    // 3. Conditionally add AWS provider if needed
    if (needsAws) {
      providers.push({
        provide: AwsSecretsConfigProvider,
        useFactory: (staticProvider: StaticConfigProvider, awsProvider: any) => {
          return new AwsSecretsConfigProvider(awsProvider, staticConfig.aws)
        },
        inject: [StaticConfigProvider, 'AWS_SECRETS_PROVIDER'],
      })

      // Add generic AWS provider
      providers.push({
        provide: 'AWS_SECRETS_PROVIDER',
        useFactory: () => {
          // For now, return a simple provider that we can enhance later
          // TODO: Integrate with @libs/config AWS provider when available
          return {
            loadSecret: async (secretId: string, region: string) => {
              console.warn(`AWS Secrets Provider not yet implemented for ${secretId} in ${region}`)
              return {}
            },
          }
        },
      })
    }

    // 4. Add environment override provider if enabled
    if (options.enableEnvOverrides) {
      providers.push(EnvOverrideProvider)
    }

    // 5. Add any custom providers
    if (options.customProviders?.length) {
      providers.push(...options.customProviders)
    }

    return {
      global: true,
      module: EcoSolverConfigModule,
      providers,
      exports: [EcoSolverConfigService],
    }
  }

  // Convenience methods for common configurations
  static withAWS(region = 'us-east-2'): DynamicModule {
    return this.forRoot({
      enableAws: true,
      enableEnvOverrides: true,
      awsRegion: region,
    })
  }

  static withFullFeatures(): DynamicModule {
    return this.forRoot({
      enableAws: true,
      enableEnvOverrides: true,
    })
  }

  static base(): DynamicModule {
    return this.forRoot({ enableAws: false })
  }
}
