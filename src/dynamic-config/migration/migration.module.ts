import { AwsToMongoDbMigrationService } from '@/dynamic-config/migration/aws-to-mongodb-migration.service'
import { Configuration, ConfigurationSchema } from '@/dynamic-config/schemas/configuration.schema'
import {
  ConfigurationAudit,
  ConfigurationAuditSchema,
} from '@/dynamic-config/schemas/configuration-audit.schema'
import { DynamicConfigAuditRepository } from '@/dynamic-config/repositories/dynamic-config-audit.repository'
import { DynamicConfigAuditService } from '@/dynamic-config/services/dynamic-config-audit.service'
import { DynamicConfigRepository } from '@/dynamic-config/repositories/dynamic-config.repository'
import { DynamicConfigSanitizerService } from '@/dynamic-config/services/dynamic-config-sanitizer.service'
import { DynamicConfigService } from '@/dynamic-config/services/dynamic-config.service'
import { DynamicConfigValidationService } from '@/dynamic-config/migration/dynamic-config-validation.service'
import { DynamicConfigValidatorService } from '@/dynamic-config/services/dynamic-config-validator.service'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Module } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { ModuleRefProvider } from '@/common/services/module-ref-provider'
import { MongooseModule } from '@nestjs/mongoose'

/**
 * Migration module that handles configuration migration and validation
 * This module breaks the circular dependency between ConfigurationModule and EcoConfigModule
 */
@Module({
  imports: [
    // Import only the core modules we need, avoiding RequestSigningModule
    MongooseModule.forFeature([
      { name: Configuration.name, schema: ConfigurationSchema },
      { name: ConfigurationAudit.name, schema: ConfigurationAuditSchema },
    ]),
    EcoConfigModule.withAWS(), // Import the properly configured EcoConfigService
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
    // Migration services
    AwsToMongoDbMigrationService,
    DynamicConfigValidationService,

    // Core dynamic config services (without RequestSigningModule dependencies)
    DynamicConfigService,
    DynamicConfigAuditService,
    DynamicConfigValidatorService,
    DynamicConfigSanitizerService,
    DynamicConfigRepository,
    DynamicConfigAuditRepository,
    {
      provide: 'ModuleRefProviderInit',
      inject: [ModuleRef],
      useFactory: (moduleRef: ModuleRef) => {
        ModuleRefProvider.setModuleRef(moduleRef)
        return true
      },
    },
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
