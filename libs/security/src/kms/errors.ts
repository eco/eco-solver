/**
 * KMS-specific error classes for key management operations
 */

export class KMSError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KMSError"
  }
}

export class KMSKeyNotFoundError extends KMSError {
  constructor(keyId: string) {
    super(`KMS key not found: ${keyId}`)
    this.name = "KMSKeyNotFoundError"
  }
}

export class KMSSigningError extends KMSError {
  constructor(message: string) {
    super(`KMS signing failed: ${message}`)
    this.name = "KMSSigningError"
  }
}

export class KMSAccessDeniedError extends KMSError {
  constructor(keyId: string) {
    super(`Access denied to KMS key: ${keyId}`)
    this.name = "KMSAccessDeniedError"
  }
}

export class KMSConfigurationError extends KMSError {
  constructor(message: string) {
    super(`KMS configuration error: ${message}`)
    this.name = "KMSConfigurationError"
  }
}
