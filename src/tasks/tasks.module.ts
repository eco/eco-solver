import { Module } from '@nestjs/common'
import { TasksService } from './tasks.service'
import { HatsModule } from '@/hats/hats.module'

@Module({
  imports: [HatsModule],

  providers: [TasksService],
})
export class TasksModule {}
