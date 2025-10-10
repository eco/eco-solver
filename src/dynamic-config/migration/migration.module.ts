import { AwsToMongoDbMigrationService } from '@/dynamic-config/migration/aws-to-mongodb-migration.service'
import { DynamicConfigModule } from '@/dynamic-config/dynamic-config.module'
import { DynamicConfigValidationService } from '@/dynamic-config/migration/dynamic-config-validation.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

/**
 * Migration module that handles configuration migration and validation
 * This module breaks the circular dependency between ConfigurationModule and EcoConfigModule
 */
@Module({
  imports: [
    DynamicConfigModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forRootAsync({
      useFactory: () => {
        // Use static config to get MongoDB URI (same as EcoConfigService would use)
        const staticConfig = EcoConfigService.getStaticConfig()
        const dbConfig = staticConfig.database
        const uri = dbConfig.auth.enabled
          ? `${dbConfig.uriPrefix}${dbConfig.auth.username}:${dbConfig.auth.password}@${dbConfig.uri}/${dbConfig.dbName}`
          : `${dbConfig.uriPrefix}${dbConfig.uri}/${dbConfig.dbName}`

        return {
          uri,
          maxPoolSize: 10,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 30000,
          appName: 'eco-migration-cli',
        }
      },
    }),
  ],
  providers: [
    // Create a custom EcoConfigService provider that requires ConfigurationService
    {
      provide: EcoConfigService,
      useFactory: async () => {
        const service = new EcoConfigService([])
        await service.onModuleInit()
        return service
      },
    },
    AwsToMongoDbMigrationService,
    DynamicConfigValidationService,
  ],
  exports: [AwsToMongoDbMigrationService, DynamicConfigValidationService],
})
export class MigrationModule {
  static forRoot() {
    return {
      module: MigrationModule,
      global: true,
    }
  }
}
