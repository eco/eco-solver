import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { Module } from '@nestjs/common'
import { SignatureGenerator } from '@/request-signing/signature-generator'
import { SignatureVerificationService } from '@/request-signing/signature-verification.service'
import { SigningService } from '@/request-signing/signing-service'

@Module({
  imports: [EcoConfigModule],

  controllers: [],

  providers: [SignatureGenerator, SigningService, SignatureVerificationService],

  exports: [SignatureGenerator, SigningService, SignatureVerificationService],
})
export class RequestSigningModule {}
