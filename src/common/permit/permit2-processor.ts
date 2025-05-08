import { encodeFunctionData, Hex } from 'viem'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { Permit2Abi } from '@/contracts/Permit2.abi'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2TypedDataDetailsDTO } from '@/quote/dto/permit2/permit2-typed-data-details.dto'

/**
 * This class processes the permit2 transaction. It generates the transaction for the permits and executes it.
 */
export class Permit2Processor {
  /**
   * This function generates the transaction for the permit2. It encodes the function data for the permit2 function
   * and returns it as an ExecuteSmartWalletArg object.
   *
   * @param permit2 - The parameters for the permit processing.
   * @returns The transaction object for the permit.
   */
  static generateTxs(permit2: Permit2DTO): ExecuteSmartWalletArg {
    const data = this.encodeFunctionData(
      permit2.funder,
      permit2.spender,
      permit2.sigDeadline,
      permit2.signature,
      permit2.details,
    )

    return {
      to: permit2.permitContract,
      data,
      value: 0n,
    }
  }

  /**
   * This function encodes the function data for the permit2 function. It uses the ABI and function name to encode
   * the arguments and returns the encoded data.
   *
   * @param owner - The address of the owner.
   * @param spender - The address of the spender.
   * @param sigDeadline - The signature deadline.
   * @param signature - The signature.
   * @param details - The details for the permit processing.
   * @returns The encoded function data.
   */
  private static encodeFunctionData(
    owner: Hex,
    spender: Hex,
    sigDeadline: bigint,
    signature: Hex,
    details: Permit2TypedDataDetailsDTO[],
  ): Hex {
    if (details.length === 1) {
      return encodeFunctionData({
        abi: Permit2Abi,
        functionName: 'permit',
        args: [owner, this.buildPermitSingleArg(spender, sigDeadline, details[0]), signature],
      })
    }

    return encodeFunctionData({
      abi: Permit2Abi,
      functionName: 'permit',
      args: [owner, this.buildPermitBatchArg(spender, sigDeadline, details), signature],
    })
  }

  /**
   * This function builds the permit argument for a single permit. It takes the details and returns an object
   * containing the permitted token, amount, nonce, and deadline.
   *
   * @param spender - The address of the spender.
   * @param sigDeadline - The signature deadline.
   * @param details - The details for the permit processing.
   * @returns The permit argument for a single permit.
   */
  private static buildPermitSingleArg(
    spender: Hex,
    sigDeadline: bigint,
    details: Permit2TypedDataDetailsDTO,
  ) {
    return {
      details: {
        token: details.token,
        amount: BigInt(details.amount),
        expiration: Number(details.expiration),
        nonce: Number(details.nonce),
      },
      spender,
      sigDeadline,
    }
  }

  /**
   * This function builds the permit argument for a batch of permits. It takes the details and returns an object
   * containing the permitted tokens, amounts, nonce, and deadline.
   *
   * @param spender - The address of the spender.
   * @param sigDeadline - The signature deadline.
   * @param details - The details for the permit processing.
   * @returns The permit argument for a batch of permits.
   */
  private static buildPermitBatchArg(
    spender: Hex,
    sigDeadline: bigint,
    details: Permit2TypedDataDetailsDTO[],
  ) {
    return {
      details: details.map((detail) => ({
        token: detail.token,
        amount: BigInt(detail.amount),
        expiration: Number(detail.expiration),
        nonce: Number(detail.nonce),
      })),
      spender,
      sigDeadline,
    }
  }
}
