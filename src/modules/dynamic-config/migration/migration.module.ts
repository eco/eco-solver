import { AwsToMongoDbMigrationService } from '@/modules/dynamic-config/migration/aws-to-mongodb-migration.service';
import {
  Configuration,
  ConfigurationSchema,
} from '@/modules/dynamic-config/schemas/configuration.schema';
import {
  ConfigurationAudit,
  ConfigurationAuditSchema,
} from '@/modules/dynamic-config/schemas/configuration-audit.schema';
import { DynamicConfigAuditRepository } from '@/modules/dynamic-config/repositories/dynamic-config-audit.repository';
import { DynamicConfigAuditService } from '@/modules/dynamic-config/services/dynamic-config-audit.service';
import { DynamicConfigRepository } from '@/modules/dynamic-config/repositories/dynamic-config.repository';
import { DynamicConfigSanitizerService } from '@/modules/dynamic-config/services/dynamic-config-sanitizer.service';
import { DynamicConfigService } from '@/modules/dynamic-config/services/dynamic-config.service';
import { DynamicConfigValidationService } from '@/modules/dynamic-config/migration/dynamic-config-validation.service';
import { DynamicConfigValidatorService } from '@/modules/dynamic-config/services/dynamic-config-validator.service';
import { ConfigFactory } from '@/config/config-factory';
import { EventsModule } from '@/modules/events';
import { Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ModuleRefProvider } from '@/common/services/module-ref-provider';
import { MongooseModule } from '@nestjs/mongoose';

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
    EventsModule,
    MongooseModule.forRootAsync({
      useFactory: async () => {
        // Use static config to get MongoDB URI (same as EcoConfigService would use)
        await ConfigFactory.loadConfig();
        const staticConfig = ConfigFactory.getConfig();
        const dbConfig = staticConfig.mongodb;
        const uri = dbConfig.uri;

        return {
          uri,
          maxPoolSize: 10,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 30000,
          appName: 'eco-migration-cli',
        };
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
        ModuleRefProvider.setModuleRef(moduleRef);
        return true;
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
    };
  }
}
