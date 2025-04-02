import { EcoResponse } from '../common/eco-response'
import { ExecuteSmartWalletArg } from '../transaction/smart-wallets/smart-wallet.types'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { ModuleRef } from '@nestjs/core'
import { Permit2DTO } from '../quote/dto/permit2/permit2.dto'
import { Permit2TxBuilder } from './permit2-tx-builder'
import { TransactionReceipt } from 'viem'

/**
 * This class processes the permit2 transaction. It generates the transaction for the permits and executes it.
 */
@Injectable()
export class Permit2Processor implements OnModuleInit {
  private logger = new Logger(Permit2Processor.name)
  private kernelAccountClientService: KernelAccountClientService
  private permit2TxBuilder: Permit2TxBuilder

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    this.kernelAccountClientService = this.moduleRef.get(KernelAccountClientService, {
      strict: false,
    })
    this.permit2TxBuilder = this.moduleRef.get(Permit2TxBuilder, { strict: false })
  }

  /**
   * This function generates the transaction for the permit2. It encodes the function data for the permit2 function
   * and returns it as an ExecuteSmartWalletArg[] object.
   *
   * @param permit - The parameters for the permit processing.
   * @returns The transaction objects for the permits.
   */
  generateTxs(permit: Permit2DTO): EcoResponse<ExecuteSmartWalletArg[]> {
    return { response: [this.permit2TxBuilder.getPermit2Tx(permit)] }
  }

  /*
   * This function executes the transaction for the permit2. It generates the transaction and posts it on chain.
   * It then waits for the transaction receipt and returns it.
   *
   * @param chainID - The chain ID for the permit processing.
   * @param permit - The parameters for the permit processing.
   * @returns The transaction receipt for the permit tx.
   */
  async executeTxs(chainID: number, permit: Permit2DTO): Promise<EcoResponse<TransactionReceipt>> {
    const executeSmartWalletArg = this.permit2TxBuilder.getPermit2Tx(permit)
    const kernelAccountClient = await this.kernelAccountClientService.getClient(chainID!)
    const txHash = await kernelAccountClient.execute([executeSmartWalletArg])
    const receipt = await kernelAccountClient.waitForTransactionReceipt({ hash: txHash })
    return { response: receipt }
  }
}
