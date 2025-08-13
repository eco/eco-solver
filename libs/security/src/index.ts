// Security library exports - minimal interface-only version
// This avoids TypeScript compilation issues with shared library dependencies

export * from './auth/interfaces'

// Core security service interfaces
export interface IKmsService {
  encrypt(data: string): Promise<string>
  decrypt(data: string): Promise<string>
  sign(data: string): Promise<string>
}

export interface ISigningService {
  signTransaction(transaction: any): Promise<string>
  signMessage(message: string): Promise<string>
}

export interface IAuthService {
  validateSignature(message: string, signature: string): Promise<boolean>
  generateToken(payload: any): Promise<string>
}