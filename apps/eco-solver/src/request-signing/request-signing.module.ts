import { Module } from '@nestjs/common'
import { SignatureGenerator } from '@eco-solver/request-signing/signature-generator'
import { SignatureVerificationService } from '@eco-solver/request-signing/signature-verification.service'
import { SigningService } from '@eco-solver/request-signing/signing.service'

@Module({
  imports: [],

  controllers: [],

  providers: [SignatureGenerator, SigningService, SignatureVerificationService],

  exports: [SignatureGenerator, SigningService, SignatureVerificationService],
})
export class RequestSigningModule {}
