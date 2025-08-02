import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Intent, IntentSchema } from '@/modules/intents/schemas/intent.schema';
import { IntentsService } from '@/modules/intents/intents.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Intent.name, schema: IntentSchema }]),
  ],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}