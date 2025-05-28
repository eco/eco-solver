import { EcoError } from '@/common/errors/eco-error'
import { EcoResponse } from '@/common/eco-response'
import { encodeFunctionData, Hex, parseSignature, Signature } from 'viem'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { PermitAbi } from '@/contracts/Permit.abi'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import * as _ from 'lodash'

/**
 * This class processes the permit transactions. It generates the transactions for the permits and executes them.
 * It also validates the parameters for the permit processing.
 */
export class PermitProcessor {
  /**
   * This function generates the transaction for the permits. It encodes the function data for the permit function
   * and returns it as an ExecuteSmartWalletArg[] object.
   *
   * @param params - The parameters for the permit processing.
   * @returns The transaction objects for the permits.
   */
  static generateTxs(...params: PermitDTO[]): EcoResponse<ExecuteSmartWalletArg[]> {
    const { error } = this.validateParams(params)
    if (error) {
      return { error }
    }

    const permitTxs: ExecuteSmartWalletArg[] = []

    for (const paramsInstance of params) {
      permitTxs.push(this.getPermitTx(paramsInstance))
    }

    return { response: permitTxs }
  }

  /**
   * This function validates the parameters for the permit processing. It checks that at least one permit was passed
   * and all permits are for the same chain.
   *
   * @param params - The parameters for the permit processing.
   * @returns An EcoResponse object containing any errors or an empty object if valid.
   */
  private static validateParams(params: PermitDTO[]): EcoResponse<void> {
    if (params.length === 0) {
      return { error: EcoError.NoPermitsProvided }
    }

    const uniqueChainIDs = _.uniq(params.map((p) => p.chainID))

    if (uniqueChainIDs.length > 1) {
      return { error: EcoError.AllPermitsMustBeOnSameChain }
    }

    return {}
  }

  /**
   * This function generates the transaction for the permit. It encodes the function data for the permit function
   * and returns it as an ExecuteSmartWalletArg object.
   *
   * @param params - The parameters for the permit.
   * @returns The transaction object for the permit.
   */
  private static getPermitTx(params: PermitDTO): ExecuteSmartWalletArg {
    const { funder, signature, spender, token, deadline, value } = params
    const { r, s, v = 0 } = parseSignature(signature)
    const data = this.encodeFunctionData(funder, spender, value, deadline, { v, r, s } as Signature)

    return {
      to: token,
      data,
      value: 0n,
    }
  }

  static encodeFunctionData(
    funder: Hex,
    spender: Hex,
    value: bigint,
    deadline: bigint,
    signature: Signature,
  ): Hex {
    const { v, r, s } = signature
    return encodeFunctionData({
      abi: PermitAbi,
      functionName: 'permit',
      args: [funder, spender, value, deadline, Number(v), r, s],
    })
  }
}
