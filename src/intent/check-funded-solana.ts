import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { hashIntent, IntentType } from '@/utils/encodeAndHash';
import { BorshCoder, type Idl } from '@coral-xyz/anchor';
import { getChainConfig } from '@/eco-configs/utils';
import { Buffer } from "buffer"

// Constants
const VAULT_SEED = Buffer.from("vault");
const PROGRAM_ID = new PublicKey(getChainConfig(1399811149).Inbox);

// Create BorshCoder instance for Solana reward serialization
import * as portalIdl from '../solana/program/portal.json';
const svmCoder = new BorshCoder(portalIdl as Idl);

export interface SolanaTokenAmount {
  token: string; // pubkey
  amount: number; // u64
}


/**
 * Derive vault PDA from intent hash
 * Matches: Pubkey::find_program_address(&[VAULT_SEED, intent_hash.as_ref()], &crate::ID)
 * Where VAULT_SEED = b"vault" and intent_hash is a 32-byte Bytes32
 */
export function getVaultPda(intentHashBytes: Uint8Array): [PublicKey, number] {
  // Ensure intent hash is exactly 32 bytes (matches Bytes32 in Rust)
  if (intentHashBytes.length !== 32) {
    throw new Error(`Intent hash must be exactly 32 bytes, got ${intentHashBytes.length}`);
  }

  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, intentHashBytes],
    PROGRAM_ID
  );
}


/**
 * Check if a Solana intent is fully funded by examining vault balances
 */
export async function checkIntentFunding(
  connection: Connection,
  intent: IntentType
): Promise<boolean> {
  try {
    
    const { intentHash } = hashIntent(intent.destination, intent.route, intent.reward);
    const intentHashBytes = new Uint8Array(Buffer.from(intentHash.slice(2), 'hex'));
    
    // 3. Get vault PDA
    const [vaultPda] = getVaultPda(intentHashBytes);
    
    // 4. Check SOL balance (native_amount is in lamports)
    const solBalance = await connection.getBalance(vaultPda);
    console.log("JUSTLOGGING: solBalance", solBalance)
    console.log("JUSTLOGGING: intent.reward.nativeAmount", intent.reward.nativeAmount)
    if (solBalance < Number(intent.reward.nativeAmount)) {
      return false;
    }
    
    // 5. Check token balances
    for (const tokenReward of intent.reward.tokens) {
      const tokenMint = new PublicKey(tokenReward.token);
      console.log("JUSTLOGGING: tokenReward", tokenReward)

      return true; // TODO: fix
      
      try {
        // Get token account for this mint owned by vault
        const tokenAccounts = await connection.getTokenAccountsByOwner(vaultPda, {
          mint: tokenMint
        });
        
        if (tokenAccounts.value.length === 0) {
          return false; // No token account exists
        }
        
        // Check balance of the token account
        const tokenAccount = await getAccount(connection, tokenAccounts.value[0].pubkey);
        if (Number(tokenAccount.amount) < tokenReward.amount) {
          return false; // Insufficient token balance
        }
      } catch (error) {
        console.error(`Error checking token balance for ${tokenReward.token}:`, error);
        return false; // Token account doesn't exist or other error
      }
    }
    
    return true; // All balances are sufficient
    
  } catch (error) {
    console.error('Error checking intent funding:', error);
    return false;
  }
}