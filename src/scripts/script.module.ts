import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { IntentSourceModel, IntentSourceSchema } from '@/intent/schemas/intent-source.schema'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { AnalyzeFailedIntentsService } from './analyze-failed-intents.service'

const MONGODB_URI =
  process.env.MONGODB_URI ||
  (() => {
    throw new Error('MONGODB_URI environment variable is required')
  })()

@Module({
  imports: [
    // Initialize Mongoose connection
    MongooseModule.forRoot(MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      waitQueueTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      appName: 'eco-solver-scripts',
    }),
    // Register IntentSourceModel
    MongooseModule.forFeature([{ name: IntentSourceModel.name, schema: IntentSourceSchema }]),
  ],
  providers: [IntentSourceRepository, AnalyzeFailedIntentsService],
  exports: [IntentSourceRepository, AnalyzeFailedIntentsService],
})
export class ScriptModule {
}
