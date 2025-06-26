import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PermitDataRepository } from '@/intent-initiation/permit-data/repositories/permit-data.repository'
import {
  PermitData,
  PermitDataSchema,
} from '@/intent-initiation/permit-data/schemas/permit-data.schema'

@Module({
  imports: [MongooseModule.forFeature([{ name: PermitData.name, schema: PermitDataSchema }])],
  providers: [PermitDataRepository],
  exports: [PermitDataRepository],
})
export class PermitDataModule {}
