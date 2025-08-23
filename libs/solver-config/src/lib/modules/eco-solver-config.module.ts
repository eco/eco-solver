import { DynamicModule, Module, Provider } from '@nestjs/common'
import { EcoSolverConfigService } from '../services/eco-solver-config.service'
import { StaticConfigProvider } from '../providers/static-config.provider'
import { AwsSecretsConfigProvider } from '../providers/aws-secrets.provider'
import { EnvOverrideProvider } from '../providers/env-override.provider'
import { getStaticSolverConfig } from '../solver-config'
import { ConfigSource } from '../interfaces/config-source.interface'
import { AwsCredential, AwsSecretsProvider as RealAwsSecretsProvider } from '@libs/config-providers'

// Interface for AWS provider functionality (matches real provider signature)
interface AwsSecretsProvider {
  loadSecret(secretId: string): Promise<Record<string, unknown>>
}

export interface EcoSolverConfigOptions {
  enableAws?: boolean
  enableEnvOverrides?: boolean
  customProviders?: Provider[]
}

@Module({})
export class EcoSolverConfigModule {
  static forRoot(options: EcoSolverConfigOptions = {}): DynamicModule {
    // 1. Analyze static config to determine what providers are needed
    const staticConfig = getStaticSolverConfig()
    const awsCredentials = (staticConfig.aws as AwsCredential[] | undefined) || []
    const needsAws = awsCredentials.length > 0 && options.enableAws

    // 2. Build provider array based on analysis
    const providers: Provider[] = [
      // Always include static config provider
      StaticConfigProvider,

      // Core service that receives the providers
      {
        provide: EcoSolverConfigService,
        useFactory: async (...configSources: ConfigSource[]) => {
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
        useFactory: (staticProvider: StaticConfigProvider, awsProvider: AwsSecretsProvider) => {
          return new AwsSecretsConfigProvider(awsProvider, awsCredentials)
        },
        inject: [StaticConfigProvider, 'AWS_SECRETS_PROVIDER'],
      })

      // Add real AWS secrets provider using the imported provider
      const awsProviderConfig = RealAwsSecretsProvider.forRootAsync(awsCredentials)

      // Add all providers from the real AWS provider
      providers.push(...awsProviderConfig.providers)

      // Map the real provider to our expected token
      providers.push({
        provide: 'AWS_SECRETS_PROVIDER',
        useExisting: RealAwsSecretsProvider,
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
  static withAWS(): DynamicModule {
    return this.forRoot({
      enableAws: true,
      enableEnvOverrides: true,
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
