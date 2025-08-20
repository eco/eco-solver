import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CacheModule } from '@nestjs/cache-manager'
import { ConfigurationService } from './services/configuration.service'
import { ConfigurationCacheService } from './services/configuration-cache.service'

@Module({
  imports: [
    // Modern NestJS configuration with lazy loading
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true, // Enable caching
      expandVariables: true,
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
      load: [
        // Configuration providers will be loaded dynamically
        // Example: () => import('@mono-solver/providers').then((m) => m.serverConfig),
      ],
    }),
    // In-memory cache only - NO Redis for sensitive data
    CacheModule.register({
      ttl: 300000, // 5 minutes in milliseconds
      max: 100, // Limited items for security
      // No external store - memory only for sensitive configs
    }),
  ],
  providers: [ConfigurationService, ConfigurationCacheService],
  exports: [ConfigurationService, ConfigurationCacheService],
})
export class ModernConfigModule {}