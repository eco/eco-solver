import { TronWeb } from 'tronweb';

import { toError } from '@/common/utils/error-handler';
import { TvmTransactionSettings } from '@/config/schemas';
import { Logger } from '@/modules/logging';

import { TvmTransactionError } from '../errors';

/**
 * Utility class for common TVM transaction operations
 */
export class TvmTransactionUtils {
  /**
   * Waits for a transaction to be confirmed on the blockchain
   * @param client - TronWeb client instance
   * @param txId - Transaction ID to wait for
   * @param settings - Transaction settings with retry configuration
   * @param logger - Logger instance for error reporting
   * @returns true if confirmed, false if timeout
   */
  static async waitForTransaction(
    client: TronWeb,
    txId: string,
    settings: TvmTransactionSettings,
    logger?: Logger,
  ): Promise<boolean> {
    for (let i = 0; i < settings.maxTransactionAttempts; i++) {
      try {
        const txInfo = await client.trx.getTransactionInfo(txId);
        if (txInfo && txInfo.blockNumber && txInfo.receipt?.result === 'SUCCESS') {
          return true;
        }

        if (txInfo?.receipt?.result === 'FAILED') {
          throw new TvmTransactionError(
            `Transaction failed: ${txInfo.receipt.result || 'Unknown error'}`,
            txId,
            JSON.stringify(txInfo.receipt),
          );
        }
      } catch (error) {
        if (error instanceof TvmTransactionError) {
          throw error;
        }
        logger?.error('Error checking transaction', toError(error), {
          transactionId: txId,
        });
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, settings.transactionCheckInterval));
    }
    return false;
  }

  /**
   * Waits for multiple transactions to be confirmed
   * @param client - TronWeb client instance
   * @param txIds - Array of transaction IDs to wait for
   * @param settings - Transaction settings with retry configuration
   * @param logger - Logger instance for error reporting
   * @returns Promise that resolves when all transactions are confirmed
   * @throws TvmTransactionError if any transaction fails
   */
  static async waitForTransactions(
    client: TronWeb,
    txIds: string[],
    settings: TvmTransactionSettings,
    logger?: Logger,
  ): Promise<void> {
    const results = await Promise.all(
      txIds.map((txId) => this.waitForTransaction(client, txId, settings, logger)),
    );

    const failedIndex = results.findIndex((result) => !result);
    if (failedIndex !== -1) {
      throw new TvmTransactionError(
        `Transaction ${txIds[failedIndex]} failed to confirm within timeout`,
        txIds[failedIndex],
      );
    }
  }
}
