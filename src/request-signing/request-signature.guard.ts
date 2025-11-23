import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RequestHeaders } from '@/request-signing/request-headers'
import { SignatureVerificationService } from '@/request-signing/signature-verification.service'

@Injectable()
export class RequestSignatureGuard implements CanActivate {
  private readonly logger = new EcoLogger(RequestSignatureGuard.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly signatureVerificationService: SignatureVerificationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.ecoConfigService.isRequestSignatureValidationEnabled()) {
      return true
    }

    const allowedAddresses = this.ecoConfigService
      .getDynamicConfigAllowedAddresses()
      .map((a) => a.toLowerCase())

    const request = context.switchToHttp().getRequest()
    const requestHeaders = new RequestHeaders(request.headers)

    const {
      signature,
      address: claimedAddress,
      expire: expiry,
    } = requestHeaders.getSignatureValidationData()

    if (!signature || !expiry) {
      return false
    }

    const payload =
      request.method === 'GET' || request.method === 'DELETE' ? { path: request.url } : request.body

    try {
      const { error } = await this.signatureVerificationService.verifySignature(
        payload,
        signature,
        expiry,
        claimedAddress,
      )

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: EcoError.getErrorMessage(error),
          }),
        )

        throw new UnauthorizedException(`Invalid or expired signature`)
      }

      if (!allowedAddresses.includes(claimedAddress.toLowerCase())) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Address ${claimedAddress} is not authorized to make dynamic config changes`,
          }),
        )

        throw new UnauthorizedException(`Address not authorized for dynamic config changes`)
      }

      return true
    } catch (ex) {
      throw new UnauthorizedException(`Invalid or expired signature`)
    }
  }
}
