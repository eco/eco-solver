import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { KmsModule } from '../kms/kms.module'
import { initBullMQ } from '@libs/shared'
import { QUEUES } from '@libs/shared'
import { Nonce, NonceSchema } from './schemas/nonce.schema'
import { SignerService } from './signer.service'
import { SignerKmsService } from './signer-kms.service'
import { NonceService } from './nonce.service'
import { AtomicSignerService } from './atomic-signer.service'

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
