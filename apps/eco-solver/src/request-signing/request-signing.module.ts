import { Module } from '@nestjs/common'
import { SignatureGenerator } from './signature-generator'
import { SignatureVerificationService } from './signature-verification.service'
import { SigningService } from './signing.service'

@Module({
  imports: [],

  controllers: [],

  providers: [SignatureGenerator, SigningService, SignatureVerificationService],

  exports: [SignatureGenerator, SigningService, SignatureVerificationService],
})
export class RequestSigningModule {}
