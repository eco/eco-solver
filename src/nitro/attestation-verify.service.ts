import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

/**
 * A service class that provides for attestation proof verification.
 * @see {@link AttestationAuthGuard}
 */
@Injectable()
export class AttestationVerifyService implements OnModuleInit {
  private logger = new Logger(AttestationVerifyService.name)
  private readonly enclaveUrl = 'http://<ENCLAVE_SERVER_IP>:3000/attestation';
  private readonly awsRootCertificateUrl = 'https://aws-nitro-enclaves.s3.amazonaws.com/nitro-root.pem';

  constructor(private readonly ecoConfigService: EcoConfigService) { }
  onModuleInit() {
    throw new Error('Method not implemented.')
  }

  /**
   * Generates a random nonce.
   */
  generateNonce(): string {
    return crypto.randomBytes(32).toString('base64')
  }

  /**
   * Requests attestation from the enclave with a nonce.
   */
  async requestAttestation(): Promise<string> {
    const nonce = this.generateNonce()
    const response = await fetch(this.enclaveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce }),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch attestation document: ${response.statusText}`)
    }

    const attestationData = await response.json()
    return attestationData.attestation
  }

  /**
   * Verifies attestation using the AWS Nitro Root Certificate.
   */
  async verifyAttestation(attestationDocument: any, expectedNonce: string): Promise<boolean> {
    try {
      const { certificate, signature, user_data, digest } = attestationDocument

      // Decode user_data (should match nonce)
      const decodedUserData = Buffer.from(user_data, 'base64').toString()
      if (decodedUserData !== expectedNonce) {
        this.logger.error('Nonce mismatch in attestation document!')
        return false
      }

      // Fetch AWS Nitro Root Certificate
      const awsRootCert = await this.fetchAwsRootCertificate()

      // Convert certificate and signature to Buffer
      const certBuffer = Buffer.from(certificate, 'base64')
      const signatureBuffer = Buffer.from(signature, 'base64')
      const digestBuffer = Buffer.from(digest, 'base64')

      // Verify signature
      const verifier = crypto.createVerify('sha384')
      verifier.update(digestBuffer)
      verifier.end()

      const isVerified = verifier.verify(certBuffer, signatureBuffer)

      if (!isVerified) {
        this.logger.error('Attestation verification failed: Signature mismatch')
        return false
      }

      this.logger.log('Attestation successfully verified')
      return true
    } catch (error) {
      this.logger.error(`Verification error: ${error.message}`)
      return false
    }
  }

  /**
   * Fetches the AWS Nitro Enclave Root Certificate.
   */
  private async fetchAwsRootCertificate(): Promise<string> {
    const response = await fetch(this.awsRootCertificateUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch AWS Nitro Enclaves Root Certificate')
    }
    return response.text()
  }

}