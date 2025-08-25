import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { keccak256, encodePacked, encodeAbiParameters, Hex, decodeAbiParameters } from 'viem';
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
      
      const saltBytes = Buffer.from(salt.slice(2), 'hex');
      const portalBytes = new PublicKey(portal).toBytes();
      
      const encoded = svmCoder.types.encode('Route', {
        salt: { 0: Array.from(saltBytes) }, // Bytes32 struct format
        deadline: new BN(deadline.toString()), // Convert BigInt to BN for u64
        portal: { 0: Array.from(portalBytes) }, // Bytes32 struct format
        tokens: tokens.map(({ token, amount }) => ({
          token: token instanceof PublicKey ? token : new PublicKey(token),
          amount: new BN(amount.toString()) // Convert BigInt to BN for u64
        })),
        calls: calls.map(({ target, data, value }) => ({
          target: { 0: Array.from(new PublicKey(target).toBytes()) }, // Bytes32 struct format
          data: Buffer.from(data.slice(2), 'hex'), // Keep as Buffer for bytes type
          value: new BN(value.toString()) // Convert BigInt to BN for u64
        }))
      });
      
      return `0x${encoded.toString('hex')}` as Hex;
    default:
      throw new Error(`Unsupported VM type: ${route.vm}`)
  }
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

export function hashRoute(route: RouteType): Hex {
  const encoded = encodeRoute(route)
  return keccak256(encoded)
}


export function encodeReward(reward: RewardType): Hex {
  switch (reward.vm) {
    case VmType.EVM:
      // Clean the reward object - remove MongoDB fields
      const cleanReward = {
        vm: reward.vm,
        creator: reward.creator,
        prover: reward.prover,
        deadline: reward.deadline,
        nativeValue: reward.nativeAmount || 0n,
        tokens: (reward.tokens || []).map(t => ({
          token: t.token,
          amount: t.amount
        }))
      };
      console.log("ENCREWARD: reward for EVM", cleanReward);
      return encodeAbiParameters(
        [{ type: 'tuple', components: RewardStruct }],
        [cleanReward as any],
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
  const routeHash = hashRoute(route)
  const rewardHash = hashReward(reward)


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