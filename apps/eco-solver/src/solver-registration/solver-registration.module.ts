import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { RequestSigningModule } from '../request-signing/request-signing.module'
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
