import { Address, Hex } from 'viem';

import {
  SIGNATURE_ADDRESS_HEADER,
  SIGNATURE_EXPIRE_HEADER,
  SIGNATURE_HEADER,
} from '@/request-signing/interfaces/signature-headers.interface';
import { SignatureValidationData } from '@/request-signing/signature-validation-data.interface';

export class RequestHeaders {
  private headers: Record<string, any>;

  constructor(headers: Record<string, any>) {
    this.setHeaders(headers);
  }

  getSignatureValidationData(): SignatureValidationData {
    const signature = this.getSignature();
    const address = this.getAddress();
    const expire = this.getExpire();

    if (!signature || !address || !expire) {
      throw new Error('Missing or invalid signature headers');
    }

    return {
      signature,
      address,
      expire,
    };
  }

  setHeaders(headers: Record<string, any>) {
    headers = headers || {};
    const standardizedHeaders: Record<string, any> = {};

    for (const headerName of Object.keys(headers)) {
      const value = headers[headerName];
      standardizedHeaders[headerName.toLowerCase()] = value;
    }

    this.headers = standardizedHeaders;
  }

  getHeaders(): Record<string, any> {
    return this.headers;
  }

  getUserAgent(): string | undefined {
    return this.getHeader('user-agent');
  }

  getSignature(): Hex | undefined {
    return this.getHeader(SIGNATURE_HEADER);
  }

  getAddress(): Address | undefined {
    return this.getHeader(SIGNATURE_ADDRESS_HEADER);
  }

  getExpire(): number {
    const raw = this.getHeader(SIGNATURE_EXPIRE_HEADER);

    if (!raw) {
      return raw;
    }

    const n = typeof raw === 'string' ? Number(raw) : raw;
    return Number.isFinite(n) ? (n as number) : NaN;
  }

  private getHeader(name: string): any {
    return this.headers[name.toLowerCase()];
  }
}
