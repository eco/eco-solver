import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { SolverRegistrationService } from '@/modules/api/solver-registration/services/solver-registration.service';
import { ConfigModule } from '@/modules/config/config.module';
import { RequestSigningModule } from '@/request-signing/request-signing.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    RequestSigningModule,
    ConfigModule,
  ],

  controllers: [],
  providers: [SolverRegistrationService],
  exports: [SolverRegistrationService],
})
export class SolverRegistrationModule {}
