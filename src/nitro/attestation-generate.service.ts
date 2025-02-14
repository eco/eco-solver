import { Injectable, Logger } from '@nestjs/common'
import { NSM } from '@aws-nitro/nsm'

@Injectable()
export class AttestationGenerateService {
  private logger = new Logger(AttestationGenerateService.name)
  private readonly nsm: NSM

  constructor() {
    this.nsm = new NSM()
  }

  async generateAttestation(userData: string): Promise<string> {
    try {
      const userDataBuffer = Buffer.from(userData, 'utf-8')

      // Generate attestation with the nonce included
      const attestationDoc = await this.nsm.getAttestationDocument({ userDataBuffer })

      return JSON.stringify(attestationDoc)
    } catch (error) {
      throw new Error(`Failed to generate attestation: ${error.message}`)
    }
  }
}