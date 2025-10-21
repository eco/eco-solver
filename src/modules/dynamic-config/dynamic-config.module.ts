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
import { DynamicConfigController } from '@/modules/dynamic-config/controllers/dynamic-config.controller';
import { DynamicConfigRepository } from '@/modules/dynamic-config/repositories/dynamic-config.repository';
import { DynamicConfigSanitizerService } from '@/modules/dynamic-config/services/dynamic-config-sanitizer.service';
import { DynamicConfigService } from '@/modules/dynamic-config/services/dynamic-config.service';
import { DynamicConfigValidatorService } from '@/modules/dynamic-config/services/dynamic-config-validator.service';
import { EventsModule } from '@/modules/events';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RequestSigningModule } from '@/request-signing/request-signing.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Configuration.name, schema: ConfigurationSchema },
      { name: ConfigurationAudit.name, schema: ConfigurationAuditSchema },
    ]),
    EventsModule,
    RequestSigningModule,
  ],

  controllers: [DynamicConfigController],

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
export class DynamicConfigModule {}
