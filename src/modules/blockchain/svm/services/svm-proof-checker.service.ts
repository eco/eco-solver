import { Injectable } from '@nestjs/common';

import { Hex } from 'viem';
import { Connection, PublicKey } from '@solana/web3.js';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { toBuffer } from '@/modules/blockchain/svm/utils/buffer';
import { SolanaConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

const PROOF_SEED = Buffer.from('proof');

interface ProofAccount {
  destination: bigint;
  claimant: PublicKey;
}

@Injectable()
export class SvmProofCheckerService {
  private connection: Connection;

  constructor(
    private readonly solanaConfigService: SolanaConfigService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(SvmProofCheckerService.name);
    this.connection = new Connection(this.solanaConfigService.rpcUrl, 'confirmed');
  }

  /**
   * Find the proof PDA for a given intent hash and prover program
   */
  private findProofPda(intentHash: Uint8Array, proverProgramId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([PROOF_SEED, intentHash], proverProgramId);
  }

  /**
   * Deserialize a Proof account
   */
  private deserializeProof(data: Buffer): ProofAccount {
    // Skip 8-byte discriminator
    const accountData = data.slice(8);

    // Read destination (u64 - 8 bytes, little endian)
    const destinationBytes = accountData.slice(0, 8);
    const destination = BigInt(`0x${Buffer.from(destinationBytes).reverse().toString('hex')}`);

    // Read claimant (Pubkey - 32 bytes)
    const claimant = new PublicKey(accountData.slice(8, 40));

    return { destination, claimant };
  }

  /**
   * Check if an intent is marked as proven on-chain
   */
  async checkIntentProven(
    intentHash: string,
    proverAddress: UniversalAddress,
  ): Promise<{
    proven: boolean;
    proofPda?: PublicKey;
    proof?: ProofAccount;
    transactionSignature?: string;
  }> {
    try {
      const intentHashBuffer = toBuffer(intentHash as Hex);
      const proverSolanaAddress = AddressNormalizer.denormalizeToSvm(proverAddress);
      const proverProgramId = new PublicKey(proverSolanaAddress);

      const [proofPda, bump] = this.findProofPda(intentHashBuffer, proverProgramId);

      this.logger.debug(
        `Checking proof for intent ${intentHash}, prover ${proverProgramId.toBase58()}, PDA ${proofPda.toBase58()} (bump: ${bump})`,
      );

      const accountInfo = await this.connection.getAccountInfo(proofPda);

      if (!accountInfo) {
        this.logger.debug(`No proof account found for intent ${intentHash}`);
        return { proven: false };
      }

      // Verify the account is owned by the prover program
      if (!accountInfo.owner.equals(proverProgramId)) {
        this.logger.warn(
          `Proof account exists but owned by ${accountInfo.owner.toBase58()}, expected ${proverProgramId.toBase58()}`,
        );
        return { proven: false };
      }

      // Deserialize the proof
      const proof = this.deserializeProof(accountInfo.data);

      // Get the transaction signature that created this proof account
      let transactionSignature: string | undefined;
      try {
        const signatures = await this.connection.getSignaturesForAddress(proofPda, { limit: 1 });
        if (signatures.length > 0) {
          transactionSignature = signatures[0].signature;
        }
      } catch (error) {
        this.logger.warn(`Failed to get transaction signature for proof account: ${error}`);
      }

      this.logger.debug(
        `Intent ${intentHash} is proven! Destination: ${proof.destination}, Claimant: ${proof.claimant.toBase58()}, Tx: ${transactionSignature || 'unknown'}`,
      );

      return { proven: true, proofPda, proof, transactionSignature };
    } catch (error) {
      this.logger.error(`Error checking proof for intent ${intentHash}:`, error as Error);
      return { proven: false };
    }
  }

  /**
   * Check multiple intents for proofs in batch
   */
  async checkMultipleIntentsProven(
    intents: Intent[],
  ): Promise<Map<string, { proven: boolean; proof?: ProofAccount }>> {
    const results = new Map<string, { proven: boolean; proof?: ProofAccount }>();

    for (const intent of intents) {
      const result = await this.checkIntentProven(intent.intentHash, intent.reward.prover);
      results.set(intent.intentHash, {
        proven: result.proven,
        proof: result.proof,
      });
    }

    return results;
  }
}

