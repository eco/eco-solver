import { KmsService } from '@/kms/kms.service'
import { Module } from '@nestjs/common'

@Module({
  imports: [
  ],
  providers: [KmsService],
  exports: [KmsService],
})
export class KmsModule { }
