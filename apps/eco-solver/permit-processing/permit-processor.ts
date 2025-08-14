import { EcoError } from '@/common/errors/eco-error'
import { EcoResponse } from '@/common/eco-response'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { ModuleRef } from '@nestjs/core'
import { PermitProcessingParams } from '@/permit-processing/interfaces/permit-processing-params.interface'
import { PermitTxBuilder } from '@/permit-processing/permit-tx-builder'
import { TransactionReceipt } from 'viem'
import * as _ from 'lodash'

/**
 * This class processes the permit transactions. It generates the transactions for the permits and executes them.
 * It also validates the parameters for the permit processing.
 */
@Injectable()
export class PermitProcessor implements OnModuleInit {
  private logger = new Logger(PermitProcessor.name)
  private kernelAccountClientService!: KernelAccountClientService
  private permitTxBuilder!: PermitTxBuilder

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    this.kernelAccountClientService = this.moduleRef.get(KernelAccountClientService, {
      strict: false,
    })
    this.permitTxBuilder = this.moduleRef.get(PermitTxBuilder, { strict: false })
  }

  /**
   * This function generates the transaction for the permits. It encodes the function data for the permit function
   * and returns it as an ExecuteSmartWalletArg[] object.
   *
   * @param params - The parameters for the permit processing.
   * @returns The transaction objects for the permits.
   */
  generateTxs(...params: PermitProcessingParams[]): EcoResponse<ExecuteSmartWalletArg[]> {
    const { error } = this.validateParams(params)
    if (error) {
      return { error }
    }

    const permitTxs: ExecuteSmartWalletArg[] = []

    for (const paramsInstance of params) {
      permitTxs.push(this.permitTxBuilder.getPermitTx(paramsInstance))
    }

    return { response: permitTxs }
  }

  /**
   * This function executes the transactions for the permits. It generates the transactions and posts them to the chain.
   * It then waits for the transaction receipt and returns it.
   *
   * @param params - The parameters for the permit processing.
   * @returns The transaction receipt for the permits.
   */
  async executeTxs(...params: PermitProcessingParams[]): Promise<EcoResponse<TransactionReceipt>> {
    const { response: permitTxs, error } = this.generateTxs(...params)

    if (error) {
      return { error }
    }

    const chainID = params[0].chainID
    const kernelAccountClient = await this.kernelAccountClientService.getClient(chainID!)
    const txHash = await kernelAccountClient.execute(permitTxs!)
    const receipt = await kernelAccountClient.waitForTransactionReceipt({ hash: txHash })
    return { response: receipt }
  }

  /**
   * This function validates the parameters for the permit processing. It checks that at least one permit was passed
   * and all permits are for the same chain.
   *
   * @param params - The parameters for the permit processing.
   * @returns An EcoResponse object containing any errors or an empty object if valid.
   */
  private validateParams(params: PermitProcessingParams[]): EcoResponse<void> {
    if (params.length === 0) {
      return { error: EcoError.NoPermitsProvided }
    }

    const uniqueChainIDs = _.uniq(params.map((p) => p.chainID))

    if (uniqueChainIDs.length > 1) {
      return { error: EcoError.AllPermitsMustBeOnSameChain }
    }

    return {}
  }
}
