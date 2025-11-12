import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';

/**
 * Context required for generating SVM prove instructions
 */
export interface SvmProveContext {
  portalProgram: any; // Anchor Program instance
  publicKey: PublicKey;
  proverAddress: UniversalAddress;
  intentHash: Buffer;
  fulfillMarkerPDA: PublicKey;
  dispatcherPDA: PublicKey;
}

/**
 * Interface for SVM-specific prover implementations
 */
export interface ISvmProver {
  readonly type: string;

  /**
   * Generate SVM prove instruction for this prover type
   */
  generateSvmProveInstruction(
    intent: Intent,
    context: SvmProveContext,
  ): Promise<{ instruction: TransactionInstruction; signers: Keypair[] } | null>;
}
