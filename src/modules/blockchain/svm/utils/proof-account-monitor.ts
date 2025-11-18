import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Proof account discriminator for HyperProver/LocalProver
 * This identifies a ProofAccount on-chain
 */
const PROOF_ACCOUNT_DISCRIMINATOR = [54, 244, 192, 233, 218, 58, 44, 242];

/**
 * Seed used to derive proof PDAs
 */
const PROOF_SEED = Buffer.from('proof');

/**
 * Structure of a Proof account on-chain:
 * - discriminator: 8 bytes
 * - destination: 8 bytes (u64, little endian)
 * - claimant: 32 bytes (Pubkey)
 */
interface ProofAccountData {
  destination: bigint;
  claimant: PublicKey;
}

/**
 * Monitors HyperProver proof accounts
 */
export class ProofAccountMonitor {
  /**
   * Derives the proof PDA for a given intent hash and prover program
   */
  static deriveProofPda(intentHash: Uint8Array, proverProgramId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([PROOF_SEED, intentHash], proverProgramId);
  }

  /**
   * Checks if a proof account exists and returns its data
   */
  static async getProofAccount(
    connection: Connection,
    proofPda: PublicKey,
  ): Promise<ProofAccountData | null> {
    try {
      const accountInfo = await connection.getAccountInfo(proofPda, 'confirmed');

      if (!accountInfo || accountInfo.data.length < 48) {
        return null;
      }

      // Verify discriminator
      const discriminator = Array.from(accountInfo.data.slice(0, 8));
      const matches = discriminator.every((b, i) => b === PROOF_ACCOUNT_DISCRIMINATOR[i]);

      if (!matches) {
        return null;
      }

      // Parse destination (u64, little endian)
      const destBytes = accountInfo.data.slice(8, 16);
      let destination = 0n;
      for (let i = 0; i < 8; i++) {
        destination |= BigInt(destBytes[i]) << BigInt(i * 8);
      }

      // Parse claimant (Pubkey)
      const claimantBytes = accountInfo.data.slice(16, 48);
      const claimant = new PublicKey(claimantBytes);

      return { destination, claimant };
    } catch (error) {
      return null;
    }
  }
}
