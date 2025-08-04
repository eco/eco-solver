import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { keccak256, encodePacked } from 'viem';
import { hashReward } from '@eco-foundation/routes-ts';

// Constants
const VAULT_SEED = Buffer.from("vault");
const PROGRAM_ID = new PublicKey('64Xrmg8iLpvW6ohBcjubTqXe56iNYqRi52yrnMfnbaA6');

export interface SolanaTokenAmount {
  token: string; // pubkey
  amount: number; // u64
}

export interface SolanaReward {
  deadline: number;
  creator: string; // pubkey
  prover: string; // pubkey
  native_amount: number;
  tokens: SolanaTokenAmount[];
}

/**
 * Calculate intent hash matching the Rust implementation
 * intent_hash(destination, &route_hash, &reward.hash())
 */
export function calculateIntentHash(
  destination: number, 
  routeHash: Uint8Array, 
  rewardHash: Uint8Array
): Uint8Array {
  const intentHashHex = keccak256(
    encodePacked(
      ['uint64', 'bytes32', 'bytes32'],
      [
        BigInt(destination),
        `0x${Buffer.from(routeHash).toString('hex')}` as `0x${string}`,
        `0x${Buffer.from(rewardHash).toString('hex')}` as `0x${string}`
      ]
    )
  );
  return new Uint8Array(Buffer.from(intentHashHex.slice(2), 'hex'));
}

/**
 * Derive vault PDA from intent hash
 * Matches: Pubkey::find_program_address(&[VAULT_SEED, intent_hash.as_ref()], &crate::ID)
 */
export function getVaultPda(intentHashBytes: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, intentHashBytes],
    PROGRAM_ID
  );
}

/**
 * Calculate reward hash for Solana reward structure
 * This should match your Solana reward encoding logic
 */
export function calculateSolanaRewardHash(reward: SolanaReward): Uint8Array {
  // TODO: Implement proper Solana reward encoding/hashing
  // This should match the reward.hash() implementation in your Solana program
  const rewardData = encodePacked(
    ['uint64', 'bytes32', 'bytes32', 'uint64'],
    [
      BigInt(reward.deadline),
      `0x${Buffer.from(new PublicKey(reward.creator).toBytes()).toString('hex')}` as `0x${string}`,
      `0x${Buffer.from(new PublicKey(reward.prover).toBytes()).toString('hex')}` as `0x${string}`,
      BigInt(reward.native_amount)
    ]
  );
  
  const hash = keccak256(rewardData);
  return new Uint8Array(Buffer.from(hash.slice(2), 'hex'));
}

/**
 * Check if a Solana intent is fully funded by examining vault balances
 */
export async function checkIntentFunding(
  connection: Connection,
  destination: number,
  routeHash: Uint8Array,
  reward: SolanaReward
): Promise<boolean> {
  try {
    // 1. Calculate reward hash
    const rewardHash = calculateSolanaRewardHash(reward);
    console.log("JUSTLOGGING: rewardHash", rewardHash)
    const rewardHashLib = hashReward(reward as any); // TODO: fix this
    console.log("JUSTLOGGING: rewardHashLib", rewardHashLib)
    
    // 2. Calculate intent hash
    const intentHashBytes = calculateIntentHash(destination, routeHash, rewardHash);
    
    // 3. Get vault PDA
    const [vaultPda] = getVaultPda(intentHashBytes);
    
    // 4. Check SOL balance (native_amount is in lamports)
    const solBalance = await connection.getBalance(vaultPda);
    console.log("JUSTLOGGING: solBalance", solBalance)
    console.log("JUSTLOGGING: reward.native_amount", reward.native_amount)
    if (solBalance < reward.native_amount) {
      return false;
    }
    
    // 5. Check token balances
    for (const tokenReward of reward.tokens) {
      const tokenMint = new PublicKey(tokenReward.token);
      console.log("JUSTLOGGING: tokenReward", tokenReward)
      
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

/**
 * Utility function to create intent hash from route and reward data
 */
export function createIntentHash(
  destination: number,
  routeHash: string | Uint8Array,
  reward: SolanaReward
): Uint8Array {
  const routeHashBytes = typeof routeHash === 'string' 
    ? new Uint8Array(Buffer.from(routeHash.replace('0x', ''), 'hex'))
    : routeHash;
    
  const rewardHash = calculateSolanaRewardHash(reward);
  return calculateIntentHash(destination, routeHashBytes, rewardHash);
}