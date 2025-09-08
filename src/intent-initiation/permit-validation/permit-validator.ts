import { Call } from '@/intent-initiation/permit-validation/interfaces/call.interface'
import { EcoError } from '@/common/errors/eco-error'
import { IntentOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoResponse } from '@/common/eco-response'
import { getEip712DomainFromToken } from '@/intent-initiation/permit-validation/signing-utils'
import { PermitAbi } from '@/contracts/Permit.abi'
import { PermitParams } from '@/intent-initiation/permit-validation/interfaces/permit-params.interface'
import { PublicClient, verifyTypedData, Address, parseSignature, Signature, Hex } from 'viem'

export class PermitValidator {
  private static logger = new IntentOperationLogger('PermitValidator')

  @LogOperation('permit_validation', IntentOperationLogger)
  static async validatePermits(
    @LogContext client: PublicClient,
    @LogContext permits: PermitParams[],
  ): Promise<EcoResponse<void>> {
    for (const permit of permits) {
      const { error } = await this.validatePermit(client, permit)

      if (error) {
        return { error }
      }
    }

    return {}
  }

  @LogOperation('single_permit_validation', IntentOperationLogger)
  static async validatePermit(
    @LogContext client: PublicClient,
    @LogContext permit: PermitParams,
  ): Promise<EcoResponse<void>> {
    if (Number(permit.deadline) < Math.floor(Date.now() / 1000)) {
      return { error: EcoError.PermitExpired }
    }

    return this.validatePermitSignature(client, permit)
  }

  @LogOperation('permit_signature_validation', IntentOperationLogger)
  static async validatePermitSignature(
    @LogContext client: PublicClient,
    @LogContext permit: PermitParams,
  ): Promise<EcoResponse<void>> {
    const { tokenAddress, owner, spender, value, deadline, nonce, signature } = permit

    if (!nonce) {
      return {}
    }

    // 1. Validate EIP-712 signature
    const domain = await getEip712DomainFromToken(client, tokenAddress)

    const validSig = await verifyTypedData({
      address: owner,
      domain,
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner,
        spender,
        value,
        nonce,
        deadline,
      },
      signature,
    })

    if (!validSig) {
      return { error: EcoError.InvalidPermitSignature }
    }

    return {}
  }

  static getPermitCalls(permits: PermitParams[]): Call[] {
    const calls = permits.map((permit) => {
      const { v, r, s } = this.parseSignature(permit.signature)

      return {
        address: permit.tokenAddress,
        abi: PermitAbi,
        functionName: 'permit',
        args: [permit.owner, permit.spender, permit.value, permit.deadline, v, r, s],
        account: permit.owner,
      }
    })

    return calls
  }

  static parseSignature(signatureHex: Hex): Signature {
    return parseSignature(signatureHex)
  }

  static async getPermitNonce(
    client: PublicClient,
    tokenAddress: Address,
    owner: Address,
  ): Promise<bigint> {
    return await client.readContract({
      address: tokenAddress,
      abi: PermitAbi,
      functionName: 'nonces',
      args: [owner],
    })
  }

  @LogOperation('permit_nonce_validation', IntentOperationLogger)
  static async validateNonce(
    @LogContext client: PublicClient,
    @LogContext token: Address,
    @LogContext owner: Address,
    @LogContext expectedNonce: bigint,
  ): Promise<EcoResponse<void>> {
    const actualNonce = await this.getPermitNonce(client, token, owner)

    if (actualNonce !== expectedNonce) {
      // Log nonce validation failure using business event method
      this.logger.logPermitValidationResult('nonce-validation', 'permit_simulation', false, {
        message: 'nonce_mismatch',
        actualNonce,
        expectedNonce,
        token,
      })

      return { error: EcoError.InvalidPermitNonce }
    }

    return {}
  }
}
