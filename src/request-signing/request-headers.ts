import {
  SIGNATURE_HEADER,
  SIGNATURE_ADDRESS_HEADER,
  SIGNATURE_EXPIRE_HEADER,
} from '@/request-signing/interfaces/signature-headers.interface'
import { SignatureValidationData } from '@/request-signing/signature-validation-data.interface'

export class RequestHeaders {
  private headers: object

  constructor(headers: object) {
    this.setHeaders(headers)
  }

  getSignatureValidationData(): SignatureValidationData {
    return {
      signature: this.getHeader(SIGNATURE_HEADER),
      address: this.getHeader(SIGNATURE_ADDRESS_HEADER),
      expire: this.getHeader(SIGNATURE_EXPIRE_HEADER),
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

  getUserAgent(): string {
    return this.getHeader('user-agent')
  }

  getHeader(name: string) {
    return this.headers[name.toLowerCase()]
  }
}
