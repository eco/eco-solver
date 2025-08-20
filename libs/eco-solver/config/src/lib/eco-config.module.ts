import { Global, Module, DynamicModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CacheModule } from '@nestjs/cache-manager'
import { EcoConfigService } from './eco-config.service'
import { ConfigLoader, StaticConfigLoader } from './config-loader'
import { ConfigurationService, ConfigurationCacheService } from '@mono-solver/config-core'
import { 
  createAwsSecretsFactory, 
  createEnvFactory 
} from '@mono-solver/providers'
import { join } from 'path'

@Global()
@Module({})
export class EcoConfigModule {
  /**
   * Create config module with AWS Secrets Manager integration (Phase 3 - Full Integration)
   */
  static withAWS(): DynamicModule {
    return {
      module: EcoConfigModule,
      imports: [
        // Modern configuration with AWS Secrets Manager support
        ConfigModule.forRoot({
          load: [
            () => ConfigLoader.load(), // Legacy config loader
            createEnvFactory().useFactory,         // Modern environment provider
            createAwsSecretsFactory().useFactory,  // Modern AWS secrets provider
          ],
          isGlobal: true,
          cache: true,
          envFilePath: [
            join(process.cwd(), 'apps/eco-solver/.env.local'),
            join(process.cwd(), 'apps/eco-solver/.env'),
            join(process.cwd(), '.env.local'),
            join(process.cwd(), '.env'),
          ],
          ignoreEnvFile: process.env.NODE_ENV === 'production',
        }),
        // In-memory cache (security-first approach)
        CacheModule.register({
          ttl: 300000, // 5 minutes
          max: 100,    // Maximum cache entries
        }),
      ],
      providers: [
        // Modern configuration services
        ConfigurationCacheService,
        ConfigurationService,
        // Backward compatible service
        EcoConfigService,
      ],
      exports: [
        ConfigurationService, // Modern service
        EcoConfigService,     // Backward compatibility
      ],
    }
  }

  /**
   * Create basic config module without AWS integration (Phase 3 - Full Integration)
   */
  static base(): DynamicModule {
    return {
      module: EcoConfigModule,
      imports: [
        ConfigModule.forRoot({
          load: [
            () => ConfigLoader.load(), // Legacy config loader
            createEnvFactory().useFactory,         // Modern environment provider
          ],
          isGlobal: true,
          cache: true,
          envFilePath: [
            join(process.cwd(), 'apps/eco-solver/.env.local'),
            join(process.cwd(), 'apps/eco-solver/.env'),
            join(process.cwd(), '.env.local'),
            join(process.cwd(), '.env'),
          ],
          ignoreEnvFile: process.env.NODE_ENV === 'production',
        }),
        // In-memory cache
        CacheModule.register({
          ttl: 300000, // 5 minutes
          max: 100,    // Maximum cache entries
        }),
      ],
      providers: [
        ConfigurationCacheService,
        ConfigurationService,
        EcoConfigService,
      ],
      exports: [
        ConfigurationService,
        EcoConfigService,
      ],
    }
  }

  /**
   * Create config module for testing (Phase 3 - Build Compatibility Mode)
   */
  static forTesting(mockConfig: Record<string, any> = {}): DynamicModule {
    return {
      module: EcoConfigModule,
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ ...ConfigLoader.load(), ...mockConfig })],
          isGlobal: true,
          cache: false, // Disable cache for testing
          ignoreEnvFile: true,
        }),
      ],
      providers: [EcoConfigService],
      exports: [EcoConfigService],
    }
  }

  /**
   * Create config module with static loading (for bundled apps)
   */
  static withStaticConfig(): DynamicModule {
    return {
      module: EcoConfigModule,
      imports: [
        ConfigModule.forRoot({
          load: [
            () => StaticConfigLoader.load(), // Static config loader
            createEnvFactory().useFactory,    // Modern environment provider
          ],
          isGlobal: true,
          cache: true,
          ignoreEnvFile: process.env.NODE_ENV === 'production',
        }),
        // In-memory cache
        CacheModule.register({
          ttl: 300000, // 5 minutes
          max: 100,    // Maximum cache entries
        }),
      ],
      providers: [
        ConfigurationCacheService,
        ConfigurationService,
        EcoConfigService,
      ],
      exports: [
        ConfigurationService,
        EcoConfigService,
      ],
    }
  }
}
