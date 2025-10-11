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
import { DynamicConfigValidatorService } from '@/dynamic-config/services/dynamic-config-validator.service'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Configuration.name, schema: ConfigurationSchema },
      { name: ConfigurationAudit.name, schema: ConfigurationAuditSchema },
    ]),
    EventEmitterModule.forRoot(),
  ],

  controllers: [],

  providers: [
    DynamicConfigRepository,
    DynamicConfigAuditRepository,
    DynamicConfigValidatorService,
    DynamicConfigAuditService,
    DynamicConfigSanitizerService,
    DynamicConfigService,
  ],

  exports: [
    MongooseModule,
    DynamicConfigRepository,
    DynamicConfigAuditRepository,
    DynamicConfigService,
    DynamicConfigValidatorService,
    DynamicConfigAuditService,
    DynamicConfigSanitizerService,
  ],
})
export class DynamicConfigModule {
  static forRoot() {
    return {
      module: DynamicConfigModule,
      imports: [
        MongooseModule.forFeature([
          { name: Configuration.name, schema: ConfigurationSchema },
          { name: ConfigurationAudit.name, schema: ConfigurationAuditSchema },
        ]),
        EventEmitterModule.forRoot(),
      ],
      providers: [
        DynamicConfigRepository,
        DynamicConfigAuditRepository,
        DynamicConfigValidatorService,
        DynamicConfigAuditService,
        DynamicConfigSanitizerService,
        DynamicConfigService,
      ],
      exports: [
        MongooseModule,
        DynamicConfigRepository,
        DynamicConfigAuditRepository,
        DynamicConfigService,
        DynamicConfigValidatorService,
        DynamicConfigAuditService,
        DynamicConfigSanitizerService,
      ],
    }
  }
}
