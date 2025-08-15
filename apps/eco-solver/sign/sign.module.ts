import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Nonce, NonceSchema } from '@eco/infrastructure-database'
import { initBullMQ } from '../bullmq/bullmq.helper'
import { QUEUES } from '../common/redis/constants'
import { SignerService } from './signer.service'
import { AtomicSignerService } from './atomic-signer.service'
import { NonceService } from './nonce.service'
import { SignerKmsService } from '@/sign/signer-kms.service'
import { KmsModule } from '@/kms/kms.module'

@Module({
  imports: [
    KmsModule,
    MongooseModule.forFeature([{ name: Nonce.name, schema: NonceSchema }]),
    initBullMQ(QUEUES.SIGNER),
  ],
  providers: [SignerService, SignerKmsService, NonceService, AtomicSignerService],
  exports: [
    AtomicSignerService,
    SignerService,
    SignerKmsService,
    NonceService,
    MongooseModule, //add SignModule to the rest of the modules that import intents
  ],
})
export class SignModule {}
