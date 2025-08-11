import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { RequestSigningModule } from '@libs/security/auth'
import { SolverRegistrationService } from './services/solver-registration.service'

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    RequestSigningModule,
  ],

  controllers: [],

  providers: [SolverRegistrationService],

  exports: [SolverRegistrationService, RequestSigningModule],
})
export class SolverRegistrationModule {}
