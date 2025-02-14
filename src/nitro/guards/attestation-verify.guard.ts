import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common'
import { EcoError } from '@/common/errors/eco-error'
import { AttestationVerifyService } from '@/nitro/attestation-verify.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

class AttestationHeader {
  static SALT = "x_attestation_salt"
  static PROOF = "x_attestation_proof"
}
@Injectable()
export class AttestationAuthGuard implements CanActivate {
  private readonly logger = new Logger(AttestationAuthGuard.name);

  constructor(private readonly attestationVerifyService: AttestationVerifyService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    // Extract attestation from headers
    const attestationHeader = request.headers[AttestationHeader.PROOF]
    if (!attestationHeader) {
      throw EcoError.AttestationProofHeaderMissingError
    }

    try {
      const attestationDocument = JSON.parse(attestationHeader)
      const salt = request.headers[AttestationHeader.SALT]

      if (!salt) {
        throw EcoError.AttestationSaltHeaderMissingError
      }

      // Verify attestation
      const isVerified = await this.attestationVerifyService.verifyAttestation(attestationDocument, salt)
      if (!isVerified) {
        throw EcoError.AttestationInvalidError
      }

      return true
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Auth Guard Error: Failed to verify attestation`,
          properties: {
            error,
            attestationHeader,
          },
        }),
      )
      throw EcoError.AttestationFailedrror(error)
    }
  }
}