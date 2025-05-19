import { Call } from '@/intent-initiation/permit-validation/interfaces/call.interface'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { getEip712DomainFromToken } from '@/intent-initiation/permit-validation/signing-utils'
import { PermitAbi } from '@/contracts/Permit.abi'
import { PermitParams } from '@/intent-initiation/permit-validation/interfaces/permit-params.interface'
import { PublicClient, verifyTypedData, Address, parseSignature } from 'viem'

export class PermitValidator {
  private static logger = new EcoLogger(PermitValidator.name)

  static async validatePermits(
    client: PublicClient,
    permits: PermitParams[],
  ): Promise<EcoResponse<void>> {
    for (const permit of permits) {
      const { error } = await this.validatePermit(client, permit)

      if (error) {
        return { error }
      }
    }

    return {}
  }

  static async validatePermit(
    client: PublicClient,
    permit: PermitParams,
  ): Promise<EcoResponse<void>> {
    if (Number(permit.deadline) < Math.floor(Date.now() / 1000)) {
      return { error: EcoError.PermitExpired }
    }

    return this.validatePermitSignature(client, permit)
  }

  static async validatePermitSignature(
    client: PublicClient,
    permit: PermitParams,
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
      const { v, r, s } = parseSignature(permit.signature)

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

  static async validateNonce(
    client: PublicClient,
    token: Address,
    owner: Address,
    expectedNonce: bigint,
  ): Promise<EcoResponse<void>> {
    const actualNonce = await this.getPermitNonce(client, token, owner)

    if (actualNonce !== expectedNonce) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `⛔ Nonce mismatch for token ${token}`,
        }),
      )

      return { error: EcoError.InvalidPermitNonce }
    }

    return {}
  }
}
