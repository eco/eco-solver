import { Module } from '@nestjs/common'
import { SignatureGenerator } from '@/request-signing/signature-generator'
import { SignatureVerificationService } from '@/request-signing/signature-verification.service'
import { QuotesServerSigningService } from '@/request-signing/quotes-server-signing.service'

@Module({
  imports: [],

  controllers: [],

  providers: [SignatureGenerator, QuotesServerSigningService, SignatureVerificationService],

  exports: [SignatureGenerator, QuotesServerSigningService, SignatureVerificationService],
})
export class RequestSigningModule {}
