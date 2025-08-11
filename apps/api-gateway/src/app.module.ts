import { Module } from "@nestjs/common"
import { ApiModule } from './controllers/api.module'
import { HealthModule } from './controllers/health.module'

@Module({
  imports: [
    ApiModule,
    HealthModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
