import { Module } from '@nestjs/common'
import { RequestSignatureGuard } from '@/request-signing/request-signature.guard'
import { SignatureGenerator } from '@/request-signing/signature-generator'
import { SignatureVerificationService } from '@/request-signing/signature-verification.service'
import { SigningService } from '@/request-signing/signing.service'

@Module({
  imports: [],

  controllers: [],

  providers: [
    SignatureGenerator,
    SigningService,
    SignatureVerificationService,
    RequestSignatureGuard,
  ],

  exports: [
    SignatureGenerator,
    SigningService,
    SignatureVerificationService,
    RequestSignatureGuard,
  ],
})
export class RequestSigningModule {}
