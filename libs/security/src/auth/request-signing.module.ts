import { Module } from '@nestjs/common'
import { SignatureGenerator } from './signature-generator'
import { SigningService } from './signing.service'
import { SignatureVerificationService } from './signature-verification.service'

@Module({
  imports: [],

  controllers: [],

  providers: [SignatureGenerator, SigningService, SignatureVerificationService],

  exports: [SignatureGenerator, SigningService, SignatureVerificationService],
})
export class RequestSigningModule {}
