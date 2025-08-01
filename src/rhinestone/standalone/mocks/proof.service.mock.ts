import { Injectable } from '@nestjs/common'

@Injectable()
export class MockProofService {
  async generateProof(params: any): Promise<any> {
    return {
      proof: '0x0000000000000000000000000000000000000000000000000000000000000000',
    }
  }

  isProverSupported(prover: string): boolean {
    return true
  }
}
