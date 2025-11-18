import * as api from '@opentelemetry/api';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

import { ISvmWallet, SvmTransactionOptions } from '@/common/interfaces/svm-wallet.interface';
import { getErrorMessage, toError } from '@/common/utils/error-handler';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { VaultClient } from './vault-client';

/**
 * Vault wallet implementation for SVM using HashiCorp Vault Transit Secrets Engine
 * Private keys remain in Vault and never leave - only signing operations are performed via API
 */
export class VaultWallet implements ISvmWallet {
  readonly connection: Connection;
  private readonly vaultClient: VaultClient;
  private readonly publicKey: PublicKey;
  private readonly otelService: OpenTelemetryService;

  constructor(
    connection: Connection,
    vaultClient: VaultClient,
    publicKey: PublicKey,
    otelService: OpenTelemetryService,
  ) {
    this.connection = connection;
    this.vaultClient = vaultClient;
    this.publicKey = publicKey;
    this.otelService = otelService;
  }

  async getAddress(): Promise<PublicKey> {
    return this.publicKey;
  }

  async signTransaction(
    transaction: Transaction | VersionedTransaction,
  ): Promise<Transaction | VersionedTransaction> {
    return this.otelService.tracer.startActiveSpan(
      'svm.vault_wallet.signTransaction',
      {
        attributes: {
          'svm.wallet_address': this.publicKey.toString(),
          'svm.transaction_type': transaction instanceof Transaction ? 'legacy' : 'versioned',
          'svm.operation': 'signTransaction',
          'svm.wallet_type': 'vault',
        },
      },
      async (span) => {
        try {
          // Serialize transaction to get the message for signing
          let message: Uint8Array;

          if (transaction instanceof Transaction) {
            // For legacy transactions
            span.addEvent('svm.vault.serializing_legacy_transaction');
            transaction.feePayer = this.publicKey;

            if (!transaction.recentBlockhash) {
              const { blockhash } = await this.connection.getLatestBlockhash();
              transaction.recentBlockhash = blockhash;
            }

            message = transaction.serializeMessage();
          } else {
            // For versioned transactions
            span.addEvent('svm.vault.serializing_versioned_transaction');
            message = transaction.message.serialize();
          }

          span.addEvent('svm.vault.requesting_signature');
          span.setAttribute('svm.message_length', message.length);

          // Sign with Vault
          const signature = await this.vaultClient.sign(message);

          span.addEvent('svm.vault.signature_received');
          span.setAttribute('svm.signature_length', signature.length);

          // Add signature to transaction
          if (transaction instanceof Transaction) {
            transaction.addSignature(this.publicKey, Buffer.from(signature));
            span.addEvent('svm.transaction.signed_legacy');
          } else {
            // For versioned transactions, we need to add the signature
            transaction.addSignature(this.publicKey, Buffer.from(signature));
            span.addEvent('svm.transaction.signed_versioned');
          }

          span.setStatus({ code: api.SpanStatusCode.OK });
          return transaction;
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });
          throw new Error(`VaultWallet failed to sign transaction: ${getErrorMessage(error)}`);
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
    return this.otelService.tracer.startActiveSpan(
      'svm.vault_wallet.sendTransaction',
      {
        attributes: {
          'svm.wallet_address': this.publicKey.toString(),
          'svm.transaction_type': transaction instanceof Transaction ? 'legacy' : 'versioned',
          'svm.operation': 'sendTransaction',
          'svm.commitment': options?.commitment || 'confirmed',
          'svm.skip_preflight': options?.skipPreflight || false,
          'svm.wallet_type': 'vault',
        },
      },
      async (span) => {
        try {
          let lastValidBlockHeight: number | undefined;

          if (transaction instanceof Transaction) {
            span.addEvent('svm.vault.submitting_legacy');

            // For legacy transactions, we need to sign first
            // Set fee payer and recent blockhash if not set
            transaction.feePayer = this.publicKey;

            if (!transaction.recentBlockhash) {
              const blockheightInfo = await this.connection.getLatestBlockhash('confirmed');
              transaction.recentBlockhash = blockheightInfo.blockhash;
              lastValidBlockHeight = blockheightInfo.lastValidBlockHeight;
            } else {
              // If blockhash is already set, try to get the lastValidBlockHeight
              const blockheightInfo = await this.connection.getLatestBlockhash('confirmed');
              lastValidBlockHeight = blockheightInfo.lastValidBlockHeight;
            }

            // Serialize and sign with Vault
            const message = transaction.serializeMessage();
            span.addEvent('svm.vault.requesting_signature');
            const signature = await this.vaultClient.sign(message);
            span.addEvent('svm.vault.signature_received');

            transaction.addSignature(this.publicKey, Buffer.from(signature));

            // Submit transaction
            const txSignature = await this.connection.sendRawTransaction(transaction.serialize(), {
              skipPreflight: options?.skipPreflight || false,
              preflightCommitment: options?.preflightCommitment || 'confirmed',
              maxRetries: options?.maxRetries,
            });

            span.setAttribute('svm.transaction_signature', txSignature);
            span.setAttribute('svm.last_valid_block_height', lastValidBlockHeight);
            span.addEvent('svm.transaction.submitted');

            // Wait for confirmation
            span.addEvent('svm.transaction.confirmation_started');
            await this.connection.confirmTransaction(
              {
                signature: txSignature,
                blockhash: transaction.recentBlockhash,
                lastValidBlockHeight: lastValidBlockHeight!,
              },
              options?.commitment || 'confirmed',
            );

            span.addEvent('svm.transaction.confirmed');
            span.setStatus({ code: api.SpanStatusCode.OK });

            return txSignature;
          } else {
            span.addEvent('svm.vault.submitting_versioned');

            const blockheightInfo = await this.connection.getLatestBlockhash('confirmed');
            lastValidBlockHeight = blockheightInfo.lastValidBlockHeight;

            // For versioned transactions
            const message = transaction.message.serialize();
            span.addEvent('svm.vault.requesting_signature');
            const signature = await this.vaultClient.sign(message);
            span.addEvent('svm.vault.signature_received');

            transaction.addSignature(this.publicKey, Buffer.from(signature));

            const txSignature = await this.connection.sendTransaction(transaction, {
              skipPreflight: options?.skipPreflight || false,
              preflightCommitment: options?.preflightCommitment || 'confirmed',
              maxRetries: options?.maxRetries,
            });

            span.setAttribute('svm.transaction_signature', txSignature);
            span.setAttribute('svm.last_valid_block_height', lastValidBlockHeight);
            span.addEvent('svm.transaction.submitted');

            // Always wait for confirmation 
            // Extract blockhash from versioned transaction
            const messageBlockhash = transaction.message.recentBlockhash;
            span.addEvent('svm.transaction.confirmation_started');
            await this.connection.confirmTransaction(
              {
                signature: txSignature,
                blockhash: messageBlockhash,
                lastValidBlockHeight: lastValidBlockHeight,
              },
              options?.commitment || 'confirmed',
            );
            span.addEvent('svm.transaction.confirmed');

            span.setStatus({ code: api.SpanStatusCode.OK });
            return txSignature;
          }
        } catch (error) {
          span.recordException(toError(error));
          span.setStatus({ code: api.SpanStatusCode.ERROR });

          // Check if this is a SendTransactionError and extract detailed logs
          if (error && typeof error === 'object' && 'getLogs' in error) {
            try {
              const logs = await (error as any).getLogs(this.connection);
              const detailedError = new Error(
                `VaultWallet failed to send transaction: ${getErrorMessage(error)}\nDetailed logs:\n${logs.join('\n')}`,
              );
              throw detailedError;
            } catch (logError) {
              const errorWithLogs = error as any;
              if (errorWithLogs.logs && Array.isArray(errorWithLogs.logs)) {
                const detailedError = new Error(
                  `VaultWallet failed to send transaction: ${getErrorMessage(error)}\nTransaction logs:\n${errorWithLogs.logs.join('\n')}`,
                );
                throw detailedError;
              }
            }
          }

          throw new Error(`VaultWallet failed to send transaction: ${getErrorMessage(error)}`);
        } finally {
          span.end();
        }
      },
    );
  }

  async getBalance(): Promise<bigint> {
    const balance = await this.connection.getBalance(this.publicKey);
    return BigInt(balance);
  }
}
