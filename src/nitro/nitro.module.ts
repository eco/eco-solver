import { AttestationGenerateService } from '@/nitro/attestation-generate.service'
import { AttestationVerifyService } from '@/nitro/attestation-verify.service'
import { Module } from '@nestjs/common'

@Module({
  imports: [
  ],
  providers: [AttestationGenerateService, AttestationVerifyService],
  exports: [
    AttestationGenerateService,
    AttestationVerifyService,
  ],
})

/**
 * A module for dealing with the nitro service.
 */
export class NitroModule { }
