import { TronWeb } from 'tronweb';

import { BaseTvmWallet } from '@/common/abstractions/base-tvm-wallet.abstract';
import { TvmTransactionOptions } from '@/common/interfaces/tvm-wallet.interface';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

export class BasicWallet extends BaseTvmWallet {
  constructor(
    private readonly tronWeb: TronWeb,
    private readonly logger: SystemLoggerService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.logger.setContext('TvmBasicWallet');
  }

  async getAddress(): Promise<string> {
    const address = this.tronWeb.defaultAddress.base58;
    if (!address) {
      throw new Error('No default address set in TronWeb instance');
    }
    return address;
  }

  async sendTrx(to: string, amount: bigint): Promise<string> {
    const span = this.otelService.startSpan('tvm.wallet.sendTrx', {
      attributes: {
        'tvm.to_address': to,
        'tvm.amount': amount.toString(),
        'tvm.operation': 'sendTrx',
      },
    });

    try {
      const fromAddress = await this.getAddress();
      span.setAttribute('tvm.from_address', fromAddress);

      // Build transaction
      const transaction = await this.tronWeb.transactionBuilder.sendTrx(
        to,
        Number(amount), // TronWeb expects number for TRX amount
        fromAddress,
      );

      // Sign transaction
      const signedTransaction = await this.tronWeb.trx.sign(transaction);

      // Broadcast transaction
      const result = await this.tronWeb.trx.sendRawTransaction(signedTransaction);

      if (!result.result) {
        throw new Error(`Transaction failed: ${result.message || 'Unknown error'}`);
      }

      const txId = result.txid;
      span.setAttribute('tvm.transaction_id', txId);
      span.setStatus({ code: 0 }); // OK

      this.logger.log(`TRX transfer sent: ${txId}`);
      return txId;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  async triggerSmartContract(
    contractAddress: string,
    functionSelector: string,
    parameter: any[],
    options?: TvmTransactionOptions,
  ): Promise<string> {
    const span = this.otelService.startSpan('tvm.wallet.triggerSmartContract', {
      attributes: {
        'tvm.contract_address': contractAddress,
        'tvm.function_selector': functionSelector,
        'tvm.operation': 'triggerSmartContract',
        'tvm.has_call_value': !!options?.callValue,
        'tvm.fee_limit': options?.feeLimit || 150000000, // Default 150 TRX
      },
    });

    try {
      const fromAddress = await this.getAddress();
      span.setAttribute('tvm.from_address', fromAddress);

      // Default options
      const txOptions = {
        feeLimit: options?.feeLimit || 150000000, // 150 TRX default
        callValue: options?.callValue || 0,
        tokenValue: options?.tokenValue,
        tokenId: options?.tokenId,
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
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Helper method to approve TRC20 tokens
   */
  async approveTrc20(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint,
    options?: TvmTransactionOptions,
  ): Promise<string> {
    const parameter = [
      { type: 'address', value: TronWeb.address.toHex(spenderAddress) },
      { type: 'uint256', value: amount.toString() },
    ];

    return this.triggerSmartContract(tokenAddress, 'approve(address,uint256)', parameter, options);
  }

  /**
   * Helper method to transfer TRC20 tokens
   */
  async transferTrc20(
    tokenAddress: string,
    toAddress: string,
    amount: bigint,
    options?: TvmTransactionOptions,
  ): Promise<string> {
    const parameter = [
      { type: 'address', value: TronWeb.address.toHex(toAddress) },
      { type: 'uint256', value: amount.toString() },
    ];

    return this.triggerSmartContract(tokenAddress, 'transfer(address,uint256)', parameter, options);
  }
}
