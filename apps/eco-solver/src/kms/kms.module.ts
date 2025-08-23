import { KmsService } from './kms.service'
import { Module } from '@nestjs/common'

@Module({
  imports: [],
  providers: [KmsService],
  exports: [KmsService],
})
/**
 * A module for dealing with the aws kms service.
 */
export class KmsModule {}
