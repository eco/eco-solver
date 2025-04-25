import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { SolverRegistrationService } from '@/solver-registration/services/solver-registration.service'
import { RequestSigningModule } from '@/request-signing/request-signing.module'

@Module({
  imports: [
    RequestSigningModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],

  controllers: [],

  providers: [SolverRegistrationService],

  exports: [SolverRegistrationService],
})
export class SolverRegistrationModule {}
