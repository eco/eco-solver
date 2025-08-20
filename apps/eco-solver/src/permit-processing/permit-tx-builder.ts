import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { encodeFunctionData, hexToBigInt } from "viem"
import { Hex } from "viem"
import { ExecuteSmartWalletArg } from '@eco-solver/transaction/smart-wallets/smart-wallet.types'
import { Injectable, Logger } from '@nestjs/common'
import { PermitAbi } from '@eco-solver/contracts/Permit.abi'
import { PermitProcessingParams } from '@eco-solver/permit-processing/interfaces/permit-processing-params.interface'

interface SplitSignature {
  r: Hex
  s: Hex
  v: number
}

/**
 * This class returns a transaction for a permit.
 */
@Injectable()
export class PermitTxBuilder {
  private logger = new Logger(PermitTxBuilder.name)

  /**
   * This function generates the transaction for the permit. It encodes the function data for the permit function
   * and returns it as an ExecuteSmartWalletArg object.
   *
   * @param params - The parameters for the permit.
   * @returns The transaction object for the permit.
   */
  getPermitTx(params: PermitProcessingParams): ExecuteSmartWalletArg {
    const { permit, owner, spender, value } = params
    const { signature, deadline } = permit.data
    const { r, s, v } = this.splitSignature(signature)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `getPermitTx: encodeFunctionData args:`,
        properties: {
          owner,
          spender,
          value,
          deadline,
          v,
          r,
          s,
        },
      }),
    )

    const data = encodeFunctionData({
      abi: PermitAbi,
      functionName: 'permit',
      args: [owner, spender, value, deadline, v, r, s],
    })

    // const parsedAbi = parseAbi([
    //   'function permit(address owner, address spender, uint256 value, uint256 deadline, bytes signature)',
    // ])

    // const data = encodeFunctionData({
    //   abi: parsedAbi,
    //   functionName: 'permit',
    //   args: [owner, spender, value, deadline, signature],
    // })

    return {
      to: permit.token,
      data,
      value: 0n,
    }
  }

  /**
   * This function splits the signature into its components: r, s, and v. It validates the length of the signature
   * and returns an object containing the components.
   *
   * @param sig - The signature to split.
   * @returns An object containing the r, s, and v components of the signature.
   */
  private splitSignature(sig: string): SplitSignature {
    if (!sig || sig.length !== 132) {
      throw new Error(`Invalid signature length: expected 132 chars, got ${sig.length}`)
    }

    const r = `0x${sig.slice(2, 66)}` as Hex
    const s = `0x${sig.slice(66, 130)}` as Hex
    const vHex = sig.slice(130, 132)
    const v = Number(hexToBigInt(`0x${vHex}`))
    // const v = rawV < 27 ? rawV + 27 : rawV // normalize v for on-chain compatibility

    return { r, s, v }
  }
}
