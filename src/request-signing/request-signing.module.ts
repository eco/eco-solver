import { Module } from '@nestjs/common';
import { RequestSignatureGuard } from '@/request-signing/request-signature.guard';
import { SignatureGenerator } from '@/request-signing/signature-generator';
import { SignatureVerificationService } from '@/request-signing/signature-verification.service';

@Module({
  imports: [],

  controllers: [],

  providers: [SignatureGenerator, SignatureVerificationService, RequestSignatureGuard],

  exports: [SignatureGenerator, SignatureVerificationService, RequestSignatureGuard],
})
export class RequestSigningModule {}
