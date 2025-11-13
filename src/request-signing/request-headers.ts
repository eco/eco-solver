import {
  SIGNATURE_HEADER,
  SIGNATURE_ADDRESS_HEADER,
  SIGNATURE_EXPIRE_HEADER,
} from '@/request-signing/signature-headers'
import { Hex } from 'viem'
import { SignatureValidationData } from '@/request-signing/interfaces/signature-validation-data.interface'

export class RequestHeaders {
  private headers: object

  constructor(headers: object) {
    this.setHeaders(headers)
  }

  getSignatureValidationData(): SignatureValidationData {
    return {
      signature: this.getSignature(),
      address: this.getAddress(),
      expire: this.getExpire(),
    }
  }

  setHeaders(headers: object) {
    headers = headers || {}
    const standardizedHeaders = {}

    for (const headerName of Object.keys(headers)) {
      const value = headers[headerName]
      standardizedHeaders[headerName.toLowerCase()] = value
    }

    this.headers = standardizedHeaders
  }

  getHeaders(): object {
    return this.headers
  }

  getSignature(): Hex {
    return this.getHexHeader(SIGNATURE_HEADER)
  }

  getAddress(): Hex {
    return this.getHexHeader(SIGNATURE_ADDRESS_HEADER)
  }

  getExpire(): string {
    return this.getHeader(SIGNATURE_EXPIRE_HEADER)
  }

  getUserAgent(): string {
    return this.getHeader('user-agent')
  }

  getHeader(name: string): string {
    return this.headers[name.toLowerCase()]
  }

  getHexHeader(name: string): Hex {
    return this.getHeader(name) as Hex
  }
}
