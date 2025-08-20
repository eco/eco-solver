import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { keccak256, encodePacked, encodeAbiParameters, Hex } from 'viem';
import { IntentType, RewardType, RouteType } from '@eco-foundation/routes-ts';
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

export function hashReward(reward: RewardType): Hex {
  console.log("MADDEN: encoded reward", encodeReward(reward))
  return keccak256(encodeReward(reward))
}


export function encodeRoute(route: RouteType): Hex {
  switch (route.vm) {
    case VmType.EVM:
      return encodeAbiParameters(
        [{ type: 'tuple', components: RouteStruct }],
        [route],
      )
    case VmType.SVM:
      // Use Anchor's BorshCoder for proper Solana serialization
      const { salt, deadline, portal, tokens, calls } = route;
      
      const encoded = svmCoder.types.encode('Route', {
        salt: Array.from(Buffer.from(salt.slice(2), 'hex')), // Convert hex string to 32-byte array
        deadline: new BN(deadline.toString()), // Convert BigInt to BN for u64
        portal: Array.from(Buffer.from(new PublicKey(portal).toBytes())), // Convert PublicKey to 32-byte array
        tokens: tokens.map(({ token, amount }) => ({
          token: new PublicKey(token),
          amount: new BN(amount.toString()) // Convert BigInt to BN for u64
        })),
        calls: calls.map(({ target, data, value }) => ({
          target: Array.from(Buffer.from(new PublicKey(target).toBytes())), // Convert PublicKey to 32-byte array for Bytes32
          data: Array.from(Buffer.from(data.slice(2), 'hex')), // Convert hex string to byte array
          value: new BN(value.toString()) // Convert BigInt to BN for u64
        }))
      });
      
      return `0x${encoded.toString('hex')}` as Hex;
    default:
      throw new Error(`Unsupported VM type: ${route.vm}`)
  }
}

export function hashRoute(route: RouteType): Hex {
  const encoded = encodeRoute(route)
  return keccak256(encoded)
}


export function encodeReward(reward: RewardType): Hex {
  switch (reward.vm) {
    case VmType.EVM:
      console.log("JUSTLOGGING: EVM reward", reward)
      return encodeAbiParameters(
        [{ type: 'tuple', components: RewardStruct }],
        [{ ...reward, nativeValue: reward.nativeAmount } as any], // need to cast to any because of nativeAmount -> nativeValue
      )
    case VmType.SVM:
      const { deadline, creator, prover, nativeAmount, tokens } = reward;
      
      const encoded = svmCoder.types.encode('Reward', {
        deadline: new BN(deadline.toString()),
        creator: new PublicKey(creator),
        prover: new PublicKey(prover),
        native_amount: new BN(nativeAmount.toString()),
        tokens: tokens.map(({ token, amount }) => ({
          token: new PublicKey(token),
          amount: new BN(amount.toString())
        }))
      });
      
      return `0x${encoded.toString('hex')}` as Hex;
    default:
      throw new Error(`Unsupported VM type: ${reward.vm}`)
  }
}

export function hashIntent(destination: bigint, route: RouteType, reward: RewardType): {
  routeHash: Hex
  rewardHash: Hex
  intentHash: Hex
} {
  const routeHash = hashRoute(route)
  const rewardHash = hashReward(reward)

  console.log("hashIntent: ", destination, routeHash, rewardHash)

  const intentHash = keccak256(
    encodePacked(['uint64', 'bytes32', 'bytes32'], [destination, routeHash, rewardHash]),
  )

  return {
    routeHash,
    rewardHash,
    intentHash,
  }
}

export function hashIntentSvm(destination: bigint, route: RouteType, reward: RewardType): {
  routeHash: Hex
  rewardHash: Hex
  intentHash: Hex
} {
  console.log("MADDEN: destination", destination)
  const routeHash = hashRoute(route)
  console.log("MADDEN: routeHash", routeHash)
  const rewardHash = hashReward(reward)
  console.log("MADDEN: reward", reward)

  console.log("MADDEN: rewardHash", rewardHash)


  // Match Rust: destination.to_be_bytes() (u64 as big-endian bytes)
  const destinationBytes = new Uint8Array(8);
  const view = new DataView(destinationBytes.buffer);
  view.setBigUint64(0, destination, false);

  // Match Rust: hasher.update(destination.to_be_bytes().as_slice());
  const routeHashBytes = new Uint8Array(Buffer.from(routeHash.slice(2), 'hex'));
  const rewardHashBytes = new Uint8Array(Buffer.from(rewardHash.slice(2), 'hex'));

  const combined = new Uint8Array(8 + 32 + 32);
  combined.set(destinationBytes, 0);
  combined.set(routeHashBytes, 8);
  combined.set(rewardHashBytes, 40);

  const intentHash = keccak256(`0x${Buffer.from(combined).toString('hex')}` as Hex);

  console.log("MADDEN: intentHash", intentHash)

  return {
    routeHash,
    rewardHash,
    intentHash,
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