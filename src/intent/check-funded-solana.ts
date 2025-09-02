import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { keccak256, encodePacked, encodeAbiParameters, Hex, decodeAbiParameters } from 'viem';
import { hashIntent, IntentType, RewardType, RouteType } from '@/utils/encodeAndHash';
import { VmType } from '@/eco-configs/eco-config.types';
import { BorshCoder, type Idl, BN } from '@coral-xyz/anchor';
import { RewardStruct, RouteStruct } from './abi';
import { getChainConfig } from '@/eco-configs/utils';

// Constants
const VAULT_SEED = Buffer.from("vault");
const PROGRAM_ID = new PublicKey(getChainConfig(1399811149).Inbox);

// Create BorshCoder instance for Solana reward serialization
const portalIdl = require('src/solana/program/portal.json');
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

export function decodeRoute(vm: VmType, route: Hex): RouteType {
  switch (vm) {
    case VmType.EVM:
      console.log("SAQUON decodeRoute EVM", route);
      return {
        vm: VmType.EVM,
        ...decodeAbiParameters(
          [{ type: 'tuple', components: RouteStruct }],
          route, 
        )[0]
      } as RouteType
    case VmType.SVM:
      
      // Remove '0x' prefix if present
      const hexString = route.startsWith('0x') ? route.slice(2) : route;
      const routeBuffer = Buffer.from(hexString, 'hex');
      const decoded = svmCoder.types.decode('Route', routeBuffer);
      console.log("SAQUON decodeRoute SVM", decoded);
      
      // Convert Bytes32 struct format { 0: [...] } back to hex string
      const saltHex = `0x${Buffer.from(decoded.salt[0]).toString('hex')}` as Hex;
      
      return {
        vm: VmType.SVM,
        salt: saltHex,
        deadline: BigInt(decoded.deadline.toString()),
        portal: new PublicKey(decoded.portal[0]),
        tokens: decoded.tokens.map(({ token, amount }: any) => ({
          token: token.toString() as Hex,
          amount: BigInt(amount.toString())
        })),
        calls: decoded.calls.map(({ target, data, value }: any) => ({
          target: new PublicKey(target[0]),
          data: `0x${Buffer.from(data).toString('hex')}` as Hex,
          value: BigInt(value.toString())
        }))
      }
  }
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

// Legacy encodeIntent function that works with the old interface format
export function encodeIntent(destination: bigint, route: any, reward: any): Hex {
  // Convert legacy format to new format if needed
  const newRoute: RouteType = route.vm ? route : {
    vm: route.destination === 1399811149n ? VmType.SVM : VmType.EVM,
    salt: route.salt,
    deadline: route.deadline || 0n,
    portal: route.portal || route.inbox,
    tokens: route.tokens,
    calls: route.calls
  }
  
  const newReward: RewardType = reward.vm ? reward : {
    vm: destination === 1399811149n ? VmType.SVM : VmType.EVM,
    creator: reward.creator,
    prover: reward.prover,
    deadline: reward.deadline,
    nativeAmount: reward.nativeAmount || reward.nativeValue || 0n,
    tokens: reward.tokens || []
  }
  
  const encodedRoute = encodeRoute(newRoute)
  const encodedReward = encodeReward(newReward)
  
  return encodePacked(
    ['uint64', 'bytes', 'bytes'],
    [destination, encodedRoute, encodedReward]
  )
}

// Legacy hashIntent function that works with the old interface format  
export function hashIntentLegacy(destination: bigint, route: any, reward: any): {
  routeHash: Hex
  rewardHash: Hex
  intentHash: Hex
} {
  // Convert legacy format to new format if needed
  const newRoute: RouteType = route.vm ? route : {
    vm: route.destination === 1399811149n ? VmType.SVM : VmType.EVM,
    salt: route.salt,
    deadline: route.deadline || 0n,
    portal: route.portal || route.inbox,
    tokens: route.tokens,
    calls: route.calls
  }
  
  const newReward: RewardType = reward.vm ? reward : {
    vm: destination === 1399811149n ? VmType.SVM : VmType.EVM,
    creator: reward.creator,
    prover: reward.prover,
    deadline: reward.deadline,
    nativeAmount: reward.nativeAmount || reward.nativeValue || 0n,
    tokens: reward.tokens || []
  }
  
  return hashIntent(destination, newRoute, newReward)
}