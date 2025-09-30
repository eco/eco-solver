import * as api from '@opentelemetry/api';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

import { ISvmWallet, SvmTransactionOptions } from '@/common/interfaces/svm-wallet.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

/**
 * Basic wallet implementation for SVM using a Keypair
 */
export class BasicWallet implements ISvmWallet {
  readonly connection: Connection;
  private readonly keypair: Keypair;
  private readonly otelService: OpenTelemetryService;

  constructor(connection: Connection, keypair: Keypair, otelService: OpenTelemetryService) {
    this.connection = connection;
    this.keypair = keypair;
    this.otelService = otelService;
  }

  async getAddress(): Promise<PublicKey> {
    return this.keypair.publicKey;
  }

  getKeypair(): Keypair {
    return this.keypair;
  }

  async signTransaction(
    transaction: Transaction | VersionedTransaction,
  ): Promise<Transaction | VersionedTransaction> {
    return this.otelService.tracer.startActiveSpan(
      'svm.wallet.signTransaction',
      {
        attributes: {
          'svm.wallet_address': this.keypair.publicKey.toString(),
          'svm.transaction_type': transaction instanceof Transaction ? 'legacy' : 'versioned',
          'svm.operation': 'signTransaction',
        },
      },
      async (span) => {
        try {
          if (transaction instanceof Transaction) {
            transaction.sign(this.keypair);
            span.addEvent('svm.transaction.signed_legacy');
          } else {
            // For versioned transactions
            transaction.sign([this.keypair]);
            span.addEvent('svm.transaction.signed_versioned');
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
          return transaction;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    options?: SvmTransactionOptions,
  ): Promise<string> {
    const activeSpan = api.trace.getActiveSpan();
    const span =
      activeSpan ||
      this.otelService.startSpan('svm.wallet.sendTransaction', {
        attributes: {
          'svm.wallet_address': this.keypair.publicKey.toString(),
          'svm.transaction_type': transaction instanceof Transaction ? 'legacy' : 'versioned',
          'svm.operation': 'sendTransaction',
          'svm.commitment': options?.commitment || 'confirmed',
          'svm.skip_preflight': options?.skipPreflight || false,
        },
      });

    try {
      if (transaction instanceof Transaction) {
        span.addEvent('svm.transaction.submitting_legacy');

        // For legacy transactions, use sendAndConfirmTransaction
        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.keypair],
          {
            commitment: options?.commitment || 'confirmed',
            preflightCommitment: options?.preflightCommitment || 'confirmed',
            skipPreflight: options?.skipPreflight || false,
            maxRetries: options?.maxRetries,
          },
        );

        span.setAttribute('svm.transaction_signature', signature);
        span.addEvent('svm.transaction.confirmed');
        if (!activeSpan) span.setStatus({ code: api.SpanStatusCode.OK });

        return signature;
      } else {
        span.addEvent('svm.transaction.submitting_versioned');

        // For versioned transactions
        transaction.sign([this.keypair]);
        const signature = await this.connection.sendTransaction(transaction, {
          skipPreflight: options?.skipPreflight || false,
          preflightCommitment: options?.preflightCommitment || 'confirmed',
          maxRetries: options?.maxRetries,
        });

        span.setAttribute('svm.transaction_signature', signature);
        span.addEvent('svm.transaction.submitted');

        // Wait for confirmation if not skipping
        if (!options?.skipPreflight) {
          await this.connection.confirmTransaction(signature, options?.commitment || 'confirmed');
          span.addEvent('svm.transaction.confirmed');
        }

        if (!activeSpan) span.setStatus({ code: api.SpanStatusCode.OK });
        return signature;
      }
    } catch (error) {
      if (!activeSpan) {
        span.recordException(toError(error));
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }

      // check if this is a SendTransactionError and extract detailed logs
      if (error && typeof error === 'object' && 'getLogs' in error) {
        try {
          const logs = await (error as any).getLogs(this.connection);
          const detailedError = new Error(
            `Failed to send transaction: ${getErrorMessage(error)}\nDetailed logs:\n${logs.join('\n')}`,
          );
          throw detailedError;
        } catch (logError) {
          const errorWithLogs = error as any;
          if (errorWithLogs.logs && Array.isArray(errorWithLogs.logs)) {
            const detailedError = new Error(
              `Failed to send transaction: ${getErrorMessage(error)}\nTransaction logs:\n${errorWithLogs.logs.join('\n')}`,
            );
            throw detailedError;
          }
        }
      }

      throw new Error(`Failed to send transaction: ${getErrorMessage(error)}`);
    } finally {
      if (!activeSpan) {
        span.end();
      }
    }
  }

  async getBalance(): Promise<bigint> {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    return BigInt(balance);
  }
}
