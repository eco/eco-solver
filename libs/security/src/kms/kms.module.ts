import { Module } from '@nestjs/common'
import { KmsService } from './kms.service'

@Module({
  imports: [],
  providers: [KmsService],
  exports: [KmsService],
})
/**
 * A module for dealing with the aws kms service.
 */
export class KmsModule {}
