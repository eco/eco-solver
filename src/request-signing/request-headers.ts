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
    return {
      signature: this.getSignature(),
      address: this.getAddress(),
      expire: this.getExpire(),
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

  getUserAgent(): string {
    return this.getHeader('user-agent') as string;
  }

  getSignature(): Hex {
    return this.getHeader(SIGNATURE_HEADER) as Hex;
  }

  getAddress(): Address {
    return this.getHeader(SIGNATURE_ADDRESS_HEADER) as Address;
  }

  getExpire(): number {
    return this.getHeader(SIGNATURE_EXPIRE_HEADER) as number;
  }

  private getHeader(name: string): any {
    return this.headers[name.toLowerCase()];
  }
}
