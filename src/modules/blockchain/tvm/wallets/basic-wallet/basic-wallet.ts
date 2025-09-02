import { TronWeb } from 'tronweb';
import { Abi, ContractFunctionName, getAbiItem, toFunctionSignature } from 'viem';

import {
  ContractFunctionParameter,
  ITvmWallet,
  TvmTransactionOptions,
} from '@/common/interfaces/tvm-wallet.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { TvmTransactionSettings } from '@/config/schemas';
import { TronAddress } from '@/modules/blockchain/tvm/types';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

export class BasicWallet implements ITvmWallet {
  constructor(
    public readonly tronWeb: TronWeb,
    private readonly transactionSettings: TvmTransactionSettings,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    this.logger.setContext('TvmBasicWallet');
  }

  /**
   * Gets the wallet address in base58 format
   * @returns The wallet address
   */
  async getAddress(): Promise<TronAddress> {
    const address = this.tronWeb.defaultAddress.base58;
    if (!address) {
      throw new Error('No default address set in TronWeb instance');
    }
    return address as TronAddress;
  }

  /**
   * Triggers a smart contract function call
   * @param contractAddress - The contract address to interact with
   * @param abi - The contract ABI
   * @param functionName - The function name to call
   * @param parameter - The function parameters
   * @param options - Optional transaction options (feeLimit, callValue, etc.)
   * @returns The transaction ID
   * @throws Error if contract call or broadcast fails
   */
  async triggerSmartContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, 'payable' | 'nonpayable'>,
  >(
    contractAddress: string,
    abi: abi,
    functionName: functionName,
    parameter: ContractFunctionParameter[],
    options?: TvmTransactionOptions,
  ): Promise<string> {
    const span = this.otelService.startSpan('tvm.wallet.triggerSmartContract', {
      attributes: {
        'tvm.contract_address': contractAddress,
        'tvm.function_name': functionName,
        'tvm.operation': 'triggerSmartContract',
        'tvm.has_call_value': !!options?.callValue,
        'tvm.fee_limit': options?.feeLimit || this.transactionSettings.defaultFeeLimit,
      },
    });

    try {
      const abiItem = getAbiItem({ abi, name: functionName } as any);
      const functionSelector = toFunctionSignature(abiItem as any);

      const fromAddress = await this.getAddress();
      span.setAttribute('tvm.from_address', fromAddress);

      // Default options
      const txOptions = {
        feeLimit: options?.feeLimit || this.transactionSettings.defaultFeeLimit,
        callValue: options?.callValue || 0,
        tokenValue: options?.tokenValue,
        tokenId: options?.tokenId?.toString(),
        permissionId: options?.permissionId,
      };

      // Trigger smart contract
      const result = await this.tronWeb.transactionBuilder.triggerSmartContract(
        contractAddress,
        functionSelector,
        txOptions,
        parameter,
        fromAddress,
      );

      if (!result.result.result) {
        throw new Error(`Contract call failed: ${result.result.message || 'Unknown error'}`);
      }

      // Sign transaction
      const signedTransaction = await this.tronWeb.trx.sign(result.transaction);

      // Broadcast transaction
      const broadcastResult = await this.tronWeb.trx.sendRawTransaction(signedTransaction);

      if (!broadcastResult.result) {
        throw new Error(
          `Transaction broadcast failed: ${broadcastResult.message || 'Unknown error'}`,
        );
      }

      const txId = broadcastResult.txid;
      span.setAttribute('tvm.transaction_id', txId);
      span.setStatus({ code: 0 }); // OK

      this.logger.log(`Smart contract transaction sent: ${txId}`);
      return txId;
    } catch (error) {
      span.recordException(toError(error));
      span.setStatus({ code: 2, message: getErrorMessage(error) }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }
}
