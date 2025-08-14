import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { SharedLibModule } from '@nest-migration-test/shared-lib'

@Module({
  imports: [SharedLibModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
