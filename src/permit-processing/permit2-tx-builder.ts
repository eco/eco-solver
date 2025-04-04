import { encodeFunctionData, Hex } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2TypedDataDetailsDTO } from '@/quote/dto/permit2/permit2-typed-data-details.dto'
import {
  Permit2BatchPermitAbi,
  Permit2SinglePermitAbi,
  PermitArgBatch,
  PermitArgSingle,
} from './permit2-abis'

/**
 * This class returns a transaction for a permit2.
 */
@Injectable()
export class Permit2TxBuilder {
  private logger = new Logger(Permit2TxBuilder.name)

  /**
   * This function generates the transaction for the permit2. It encodes the function data for the permit2 function
   * and returns it as an ExecuteSmartWalletArg object.
   *
   * @param permit - The parameters for the permit processing.
   * @returns The transaction object for the permit.
   */
  getPermit2Tx(permit: Permit2DTO): ExecuteSmartWalletArg {
    const permitData = permit.permitData

    const data = this.encodeFunctionData(
      permitData.getSpender(),
      BigInt(permitData.getSigDeadline()),
      permit.signature,
      permitData.getDetails(),
    )

    return {
      to: permit.permitContract,
      data,
      value: 0n,
    }
  }

  /**
   * This function encodes the function data for the permit2 function. It uses the ABI and function name to encode
   * the arguments and returns the encoded data.
   *
   * @param spender - The address of the spender.
   * @param sigDeadline - The signature deadline.
   * @param signature - The signature.
   * @param details - The details for the permit processing.
   * @returns The encoded function data.
   */
  private encodeFunctionData(
    spender: Hex,
    sigDeadline: bigint,
    signature: Hex,
    details: Permit2TypedDataDetailsDTO[],
  ): Hex {
    if (details.length === 1) {
      return encodeFunctionData({
        abi: Permit2SinglePermitAbi,
        functionName: 'permitTransferFrom',
        args: [this.buildPermitArgSingle(details[0]), spender, sigDeadline, signature],
      })
    }

    return encodeFunctionData({
      abi: Permit2BatchPermitAbi,
      functionName: 'permitTransferFrom',
      args: [this.buildPermitArgBatch(details), spender, sigDeadline, signature],
    })
  }

  /**
   * This function builds the permit argument for a single permit. It takes the details and returns an object
   * containing the permitted token, amount, nonce, and deadline.
   *
   * @param details - The details for the permit processing.
   * @returns The permit argument for a single permit.
   */
  private buildPermitArgSingle(details: Permit2TypedDataDetailsDTO): PermitArgSingle {
    return {
      permitted: {
        token: details.token as `0x${string}`,
        amount: BigInt(details.amount),
      },
      nonce: BigInt(details.nonce),
      deadline: BigInt(details.expiration), // this maps to 'deadline'
    }
  }

  /**
   * This function builds the permit argument for a batch of permits. It takes the details and returns an object
   * containing the permitted tokens, amounts, nonce, and deadline.
   *
   * @param details - The details for the permit processing.
   * @returns The permit argument for a batch of permits.
   */
  private buildPermitArgBatch(details: Permit2TypedDataDetailsDTO[]): PermitArgBatch {
    return {
      permitted: details.map((d) => ({
        token: d.token as `0x${string}`,
        amount: BigInt(d.amount),
      })),
      nonce: BigInt(details[0].nonce), // assuming shared nonce
      deadline: BigInt(details[0].expiration), // assuming shared deadline
    }
  }
}
