import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { EcoConfigService } from '@/config/eco-config.service';
import { EcoError } from '@/errors/eco-error';
import { EcoLogger } from '@/common/logging/eco-logger';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { RequestHeaders } from '@/request-signing/request-headers';
import { SignatureVerificationService } from '@/request-signing/signature-verification.service';

@Injectable()
export class RequestSignatureGuard implements CanActivate {
  private readonly logger = new EcoLogger(RequestSignatureGuard.name);

  constructor(private readonly signatureVerificationService: SignatureVerificationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!EcoConfigService.isRequestSignatureValidationEnabled()) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const requestHeaders = new RequestHeaders(request.headers);

    const {
      signature,
      address: claimedAddress,
      expire: expiry,
    } = requestHeaders.getSignatureValidationData();

    if (!signature || !expiry) {
      return false;
    }

    const payload = request.body;

    try {
      const { error } = await this.signatureVerificationService.verifySignature(
        payload,
        signature,
        expiry,
        claimedAddress,
      );

      if (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: EcoError.getErrorMessage(error),
          }),
        );
      }

      return !error;
    } catch (ex) {
      throw new UnauthorizedException(`Invalid or expired signature: ${(ex as any).message}`);
    }
  }
}
