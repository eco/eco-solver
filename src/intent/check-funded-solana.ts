import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { keccak256, encodePacked, encodeAbiParameters, Hex } from 'viem';
import { IntentType, RewardType, RouteType } from '@eco-foundation/routes-ts';
import { VmType } from '@/eco-configs/eco-config.types';
import { BorshCoder, type Idl, BN } from '@coral-xyz/anchor';

// Constants
const VAULT_SEED = Buffer.from("vault");
const PROGRAM_ID = new PublicKey('2Y57jksdfFgPy5a75tQNU21z8ESPyQnKCyuRTva3JSj9');

// Create BorshCoder instance for Solana reward serialization
const portalIdl = require('src/solana/program/portal.json');
const svmCoder = new BorshCoder(portalIdl as Idl);

// Define the RewardStruct for EVM encoding
const RewardStruct = [
  {
    "internalType": "uint64",
    "name": "deadline",
    "type": "uint64"
  },
  {
    "internalType": "address",
    "name": "creator",
    "type": "address"
  },
  {
    "internalType": "address",
    "name": "prover",
    "type": "address"
  },
  {
    "internalType": "uint256",
    "name": "nativeValue",
    "type": "uint256"
  },
  {
    "components": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "internalType": "struct TokenAmount[]",
    "name": "tokens",
    "type": "tuple[]"
  }
];

export const RouteStruct = [
  { internalType: 'bytes32', name: 'salt', type: 'bytes32' },
  { internalType: 'uint64', name: 'deadline', type: 'uint64' },
  { internalType: 'address', name: 'portal', type: 'address' },
  {
    type: 'tuple[]',
    name: 'tokens',
    components: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ]
  },
  {
    type: 'tuple[]',
    name: 'calls',
    components: [
      { internalType: 'address', name: 'target', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
      { internalType: 'uint256', name: 'value', type: 'uint256' }
    ]
  }
]

export interface SolanaTokenAmount {
  token: string; // pubkey
  amount: number; // u64
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
export function calculateSolanaRewardHash(reward: RewardType<VmType.SVM>): Uint8Array {
  // TODO: Implement proper Solana reward encoding/hashing
  // This should match the reward.hash() implementation in your Solana program
  const rewardData = encodePacked(
    ['uint64', 'bytes32', 'bytes32', 'uint64'],
    [
      BigInt(reward.deadline),
      `0x${Buffer.from(new PublicKey(reward.creator).toBytes()).toString('hex')}` as `0x${string}`,
      `0x${Buffer.from(new PublicKey(reward.prover).toBytes()).toString('hex')}` as `0x${string}`,
      BigInt(reward.nativeAmount)
    ]
  );
  
  const hash = keccak256(rewardData);
  return new Uint8Array(Buffer.from(hash.slice(2), 'hex'));
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
      console.log("JUSTLOGGING: SVM reward", reward)
      // Use Anchor's BorshCoder for proper Solana serialization
      // This matches the AnchorSerialize trait implementation in Rust
      const { deadline, creator, prover, nativeAmount, tokens } = reward;
      
      const encoded = svmCoder.types.encode('Reward', {
        deadline: new BN(deadline.toString()), // Convert BigInt to BN for u64
        creator: new PublicKey(creator),
        prover: new PublicKey(prover),
        native_amount: new BN(nativeAmount.toString()), // Convert BigInt to BN for u64
        tokens: tokens.map(({ token, amount }) => ({
          token: new PublicKey(token),
          amount: new BN(amount.toString()) // Convert BigInt to BN for u64
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

/**
 * Check if a Solana intent is fully funded by examining vault balances
 */
export async function checkIntentFunding(
  connection: Connection,
  intent: IntentType
): Promise<boolean> {
  try {
    // 1. Calculate reward hash
    const rewardHash = calculateSolanaRewardHash(intent.reward as RewardType<VmType.SVM>);
    console.log("JUSTLOGGING: rewardHash", rewardHash)
    
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