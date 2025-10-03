import { Connection, PublicKey } from '@solana/web3.js';

import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';

import { HYPER_PROVER_CONSTANTS } from './hyper-prover.constants';

/**
 * Configuration for Hyper prover utilities
 */
export interface HyperProverConfig {
  hyperlaneMailbox?: string;
  noop?: string;
  igpProgram?: string;
  igpAccount?: string;
  overheadIgpAccount?: string;
}

/**
 * Utility functions for Hyper prover PDA derivation and program access
 */
export class HyperProverUtils {
  /**
   * Get the prover dispatcher PDA
   * This matches hyper_prover::state::dispatcher_pda().0
   */
  static getProverDispatcherPDA(proverAddress: UniversalAddress): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(HYPER_PROVER_CONSTANTS.SEEDS.DISPATCHER)],
      new PublicKey(AddressNormalizer.denormalizeToSvm(proverAddress)),
    );
    return pda;
  }

  /**
   * Get the Hyperlane outbox PDA
   * This matches hyperlane_context::outbox_pda()
   * Rust: Pubkey::find_program_address(&[b"hyperlane", b"-", b"outbox"], &MAILBOX_ID).0
   */
  static getHyperlaneOutboxPDA(config?: HyperProverConfig): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(HYPER_PROVER_CONSTANTS.SEEDS.HYPERLANE),
        Buffer.from(HYPER_PROVER_CONSTANTS.SEEDS.SEPARATOR),
        Buffer.from(HYPER_PROVER_CONSTANTS.SEEDS.OUTBOX),
      ],
      this.getHyperlaneMailboxProgram(config),
    );
    return pda;
  }

  /**
   * Get the Hyperlane dispatched message PDA
   * This matches hyperlane_context::dispatched_message_pda(&unique_message.pubkey())
   * Rust: Pubkey::find_program_address(&[b"hyperlane", b"-", b"dispatched_message", b"-", unique_message.pubkey().as_ref()], &MAILBOX_ID).0
   */
  static getHyperlaneDispatchedMessagePDA(
    uniqueMessage: PublicKey,
    config?: HyperProverConfig,
  ): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(HYPER_PROVER_CONSTANTS.SEEDS.HYPERLANE),
        Buffer.from(HYPER_PROVER_CONSTANTS.SEEDS.SEPARATOR),
        Buffer.from(HYPER_PROVER_CONSTANTS.SEEDS.DISPATCHED_MESSAGE),
        Buffer.from(HYPER_PROVER_CONSTANTS.SEEDS.SEPARATOR),
        uniqueMessage.toBuffer(),
      ],
      this.getHyperlaneMailboxProgram(config),
    );
    return pda;
  }

  /**
   * Get the Hyperlane mailbox program ID
   */
  static getHyperlaneMailboxProgram(config?: HyperProverConfig): PublicKey {
    const programId =
      config?.hyperlaneMailbox || HYPER_PROVER_CONSTANTS.DEFAULT_PROGRAM_IDS.HYPERLANE_MAILBOX;
    return new PublicKey(programId);
  }

  /**
   * Get the noop program ID
   */
  static getNoopProgram(config?: HyperProverConfig): PublicKey {
    const programId = config?.noop || HYPER_PROVER_CONSTANTS.DEFAULT_PROGRAM_IDS.NOOP;
    return new PublicKey(programId);
  }

  /**
   * Get the IGP program ID
   */
  static getIgpProgram(config?: HyperProverConfig): PublicKey {
    const programId = config?.igpProgram || HYPER_PROVER_CONSTANTS.DEFAULT_PROGRAM_IDS.IGP_PROGRAM;
    return new PublicKey(programId);
  }

  /**
   * Get the IGP account
   */
  static getIgpAccount(config?: HyperProverConfig): PublicKey {
    const accountId = config?.igpAccount || HYPER_PROVER_CONSTANTS.DEFAULT_PROGRAM_IDS.IGP_ACCOUNT;
    return new PublicKey(accountId);
  }

  /**
   * Get the overhead IGP account
   */
  static getOverheadIgpAccount(config?: HyperProverConfig): PublicKey {
    const accountId =
      config?.overheadIgpAccount || HYPER_PROVER_CONSTANTS.DEFAULT_PROGRAM_IDS.OVERHEAD_IGP_ACCOUNT;
    return new PublicKey(accountId);
  }

  /**
   * Parse message ID from a Solana transaction signature
   * @param connection - Solana connection instance
   * @param signature - Transaction signature
   * @returns Promise resolving to message ID bytes or null if not found
   */
  static async parseMessageIdFromTransaction(
    connection: Connection,
    signature: string,
  ): Promise<Uint8Array | null> {
    try {
      const transaction = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction?.meta?.logMessages) {
        return null;
      }

      // Look for the "Dispatched message" log
      const dispatchedMessageLog = transaction.meta.logMessages.find((log) =>
        log.includes('Program log: Dispatched message to'),
      );

      if (!dispatchedMessageLog) {
        return null;
      }

      // Parse the message ID from the log
      // Expected format: "Program log: Dispatched message to 10, ID 0x92ca37ae8ecce8788a55825c82a6da6c19bcb3183c7e5eb2fdd95a0c37203560"
      const messageIdMatch = dispatchedMessageLog.match(/ID (0x[a-fA-F0-9]{64})/);
      if (!messageIdMatch) {
        return null;
      }

      const messageIdHex = messageIdMatch[1];
      const messageId = new Uint8Array(32);
      messageId.set(Buffer.from(messageIdHex.slice(2), 'hex'));

      return messageId;
    } catch (error) {
      return null;
    }
  }
}
