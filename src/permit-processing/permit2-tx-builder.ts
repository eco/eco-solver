import { encodeFunctionData, Hex } from 'viem'
import { Injectable } from '@nestjs/common'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2TypedDataDetailsDTO } from '@/quote/dto/permit2/permit2-typed-data-details.dto'
import {
  Permit2BatchPermitAbi,
  Permit2SinglePermitAbi,
  PermitBatchArg,
  PermitSingleArg,
} from './permit2-abis'
import { GenericOperationLogger } from '@/common/logging/loggers'

/**
 * This class returns a transaction for a permit2.
 */
@Injectable()
export class Permit2TxBuilder {
  private logger = new GenericOperationLogger('Permit2TxBuilder')

  /**
   * This function generates the transaction for the permit2. It encodes the function data for the permit2 function
   * and returns it as an ExecuteSmartWalletArg object.
   *
   * @param permit - The parameters for the permit processing.
   * @returns The transaction object for the permit.
   */
  getPermit2Tx(funder: Hex, permit: Permit2DTO): ExecuteSmartWalletArg {
    const permitData = permit.permitData

    const data = this.encodeFunctionData(
      funder,
      permitData.getSpender(),
      permitData.getSigDeadline(),
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
   * @param owner - The address of the owner.
   * @param spender - The address of the spender.
   * @param sigDeadline - The signature deadline.
   * @param signature - The signature.
   * @param details - The details for the permit processing.
   * @returns The encoded function data.
   */
  private encodeFunctionData(
    owner: Hex,
    spender: Hex,
    sigDeadline: bigint,
    signature: Hex,
    details: Permit2TypedDataDetailsDTO[],
  ): Hex {
    if (details.length === 1) {
      this.logger.logSignature(
        {
          operationType: 'permit2_encoding',
          status: 'started',
          permitType: 'permit2_single',
          signatureMethod: 'EIP-2612',
        },
        'Encoding Permit2 single permit transaction data',
        {
          details: details[0],
          spender,
          sigDeadline,
          signature,
        },
      )

      return encodeFunctionData({
        abi: Permit2SinglePermitAbi,
        functionName: 'permit',
        args: [owner, this.buildPermitSingleArg(spender, sigDeadline, details[0]), signature],
      })
    }

    this.logger.logSignature(
      {
        operationType: 'permit2_encoding',
        status: 'started',
        permitType: 'permit2_batch',
        signatureMethod: 'EIP-2612',
      },
      'Encoding Permit2 batch permit transaction data',
      {
        details,
        spender,
        sigDeadline,
        signature,
      },
    )

    return encodeFunctionData({
      abi: Permit2BatchPermitAbi,
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
  private buildPermitSingleArg(
    spender: Hex,
    sigDeadline: bigint,
    details: Permit2TypedDataDetailsDTO,
  ): PermitSingleArg {
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
  private buildPermitBatchArg(
    spender: Hex,
    sigDeadline: bigint,
    details: Permit2TypedDataDetailsDTO[],
  ): PermitBatchArg {
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
