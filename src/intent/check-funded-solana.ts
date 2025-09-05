import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
import { hashIntent, IntentType } from '@/utils/encodeAndHash'
import { BorshCoder, type Idl } from '@coral-xyz/anchor'
import { getChainConfig } from '@/eco-configs/utils'
import { Buffer } from 'buffer'

// Constants
const VAULT_SEED = Buffer.from('vault')
const PROGRAM_ID = new PublicKey(getChainConfig(1399811149).Inbox)

// Create BorshCoder instance for Solana reward serialization
import * as portalIdl from '../solana/program/portal.json'
const svmCoder = new BorshCoder(portalIdl as Idl)

export interface SolanaTokenAmount {
  token: string // pubkey
  amount: number // u64
}

/**
 * Derive vault PDA from intent hash
 * Matches: Pubkey::find_program_address(&[VAULT_SEED, intent_hash.as_ref()], &crate::ID)
 * Where VAULT_SEED = b"vault" and intent_hash is a 32-byte Bytes32
 */
export function getVaultPda(intentHashBytes: Uint8Array): [PublicKey, number] {
  // Ensure intent hash is exactly 32 bytes (matches Bytes32 in Rust)
  if (intentHashBytes.length !== 32) {
    throw new Error(`Intent hash must be exactly 32 bytes, got ${intentHashBytes.length}`)
  }

  return PublicKey.findProgramAddressSync([VAULT_SEED, intentHashBytes], PROGRAM_ID)
}

/**
 * Check if a Solana intent is fully funded by examining vault balances
 */
export async function checkIntentFunding(
  connection: Connection,
  intent: IntentType,
): Promise<boolean> {
  try {
    const { intentHash } = hashIntent(intent.destination, intent.route, intent.reward)
    const intentHashBytes = new Uint8Array(Buffer.from(intentHash.slice(2), 'hex'))

    // Get vault PDA
    const [vaultPda] = getVaultPda(intentHashBytes)

    // Prepare all accounts we need to check in a single batch request
    const accountsToFetch: PublicKey[] = []
    const tokenMints: PublicKey[] = []
    
    // Add vault PDA for SOL balance
    accountsToFetch.push(vaultPda)
    
    // Add associated token accounts for each token reward
    for (const tokenReward of intent.reward.tokens) {
      const tokenMint = new PublicKey(tokenReward.token)
      tokenMints.push(tokenMint)
      
      // Calculate the associated token account address
      const associatedTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        vaultPda,
        true // allowOwnerOffCurve - PDAs are off curve
      )
      accountsToFetch.push(associatedTokenAccount)
    }

    console.log('MONDAY: Fetching accounts in batch:', accountsToFetch.length)

    // Single batch request to get all account info
    const accountsInfo = await connection.getMultipleAccountsInfo(accountsToFetch)

    // Check SOL balance (first account is always the vault PDA)
    const vaultAccount = accountsInfo[0]
    const solBalance = vaultAccount ? vaultAccount.lamports : 0
    console.log('MONDAY: solBalance', solBalance)
    console.log('MONDAY: intent.reward.nativeAmount', intent.reward.nativeAmount)
    
    if (solBalance < Number(intent.reward.nativeAmount)) {
      return false
    }

    // Check token balances (remaining accounts are token accounts)
    for (let i = 0; i < intent.reward.tokens.length; i++) {
      const tokenReward = intent.reward.tokens[i]
      const tokenAccountInfo = accountsInfo[i + 1] // +1 because first account is vault PDA
      
      console.log('MONDAY: tokenReward', tokenReward)
      
      if (!tokenAccountInfo) {
        console.log('MONDAY: Token account does not exist for', tokenReward.token)
        return false // Token account doesn't exist
      }

      // Parse token account data to get balance
      // Token account data layout: [mint(32), owner(32), amount(8), ...]
      const tokenAccountData = tokenAccountInfo.data
      if (tokenAccountData.length < 72) {
        console.error('Invalid token account data length')
        return false
      }

      // Amount is stored as little-endian u64 at offset 64
      const amountBuffer = tokenAccountData.slice(64, 72)
      const tokenBalance = amountBuffer.readBigUInt64LE(0)
      
      console.log('MONDAY: tokenBalance', tokenBalance.toString(), 'required:', tokenReward.amount.toString())
      
      if (Number(tokenBalance) < Number(tokenReward.amount)) {
        return false // Insufficient token balance
      }
    }

    return true // All balances are sufficient
  } catch (error) {
    console.error('Error checking intent funding:', error)
    return false
  }
}
