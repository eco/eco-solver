import { Module } from '@nestjs/common'
import { SolverRegistrationModule } from './registration/solver-registration.module'
import { SolverModule } from './validation/solver.module'

@Module({
  imports: [
    SolverRegistrationModule,
    SolverModule,
    // TODO: Import capabilities modules when available
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
