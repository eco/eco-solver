import { Global, Module, DynamicModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EcoConfigService } from './eco-config.service'
import { ConfigLoader } from '@libs/eco-solver-config'
import { join } from 'path'

@Global()
@Module({})
export class EcoConfigModule {
  /**
   * Create config module with AWS Secrets Manager integration
   */
  static withAWS(): DynamicModule {
    return {
      module: EcoConfigModule,
      imports: [
        ConfigModule.forRoot({
          load: [() => ConfigLoader.load()],
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
      ],
      providers: [
        // AWS integration will be added when AWS services are migrated
        EcoConfigService,
      ],
      exports: [EcoConfigService],
    }
  }

  /**
   * Create basic config module without AWS integration
   */
  static base(): DynamicModule {
    return {
      module: EcoConfigModule,
      imports: [
        ConfigModule.forRoot({
          load: [() => ConfigLoader.load()],
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
      ],
      providers: [EcoConfigService],
      exports: [EcoConfigService],
    }
  }

  /**
   * Create config module for testing
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
}
