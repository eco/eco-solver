#!/usr/bin/env ts-node
/* eslint-disable */

import { Address, createPublicClient, createWalletClient, erc20Abi, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { optimism } from 'viem/chains'
import * as dotenv from 'dotenv'
import { VmType } from '@/eco-configs/eco-config.types'
import { encodeRoute, hashIntent, IntentType, RewardType, RouteType } from '@/utils/encodeAndHash'
import { getChainConfig } from '@/eco-configs/utils'
import config from '../config/solana'
import { PublicKey } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { portalAbi } from '@/contracts/v2-abi/Portal'
import { web3 } from '@coral-xyz/anchor'

// Load environment variables from .env file
dotenv.config()

const deadlineWindow = 7200 // 2 hours

console.log('Publishing Optimism to Solana Intent...')

// Set up Optimism client
const optimismRpcUrl = process.env.OPTIMISM_RPC_URL

const publicClient = createPublicClient({
  chain: optimism,
  transport: http(optimismRpcUrl),
})

// Load private key from environment
const privateKeyEnv = process.env.EVM_PRIVATE_KEY || process.env.PRIVATE_KEY
if (!privateKeyEnv) {
  throw new Error('OPTIMISM_PRIVATE_KEY environment variable not found')
}

const account = privateKeyToAccount(privateKeyEnv as `0x${string}`)
const walletClient = createWalletClient({
  account,
  chain: optimism,
  transport: http(optimismRpcUrl),
})

console.log(`Using account: ${account.address}`)

// Create sample route and intent data
const now = Math.floor(Date.now() / 1000)

// Generate salt as 32-byte hex string directly from timestamp
const salt = `0x${now.toString(16).padStart(64, '0')}` as `0x${string}`

// Get portal addresses
const optimismPortalAddress = getChainConfig(10).Inbox
const solanaPortalAddress: PublicKey = getChainConfig(1399811149).Inbox as PublicKey

interface TokenAmount {
  token: string
  amount: number
}

// Sample token amounts for the route (what user wants to swap on Solana)
const routeTokens: TokenAmount[] = [
  {
    token: config.intentSources[0].tokens[0], // USDC on Solana
    amount: 1_000, // 0.001 USDC (6 decimals)
  },
]

// Create reward tokens (what user pays on Optimism)
const rewardTokens: TokenAmount[] = [
  {
    token: config.intentSources[1].tokens[0], // USDC on Optimism
    amount: 36_000, // 0.0355 USDC reward (6 decimals) - includes solver fee
  },
]

// Create the reward (EVM format for Optimism)
const reward: RewardType<VmType.EVM> = {
  vm: VmType.EVM,
  deadline: BigInt(now + deadlineWindow), // 2 hours from now
  creator: account.address,
  prover: '0xde255Aab8e56a6Ae6913Df3a9Bbb6a9f22367f4C', // Placeholder - needs actual EVM prover
  nativeAmount: 0n,
  tokens: rewardTokens.map((token) => ({
    token: token.token as Address,
    amount: BigInt(token.amount),
  })),
}

// Parse command line arguments
// const args = process.argv.slice(2)
// const shouldFund = args.includes('--fund') && args[args.indexOf('--fund') + 1] === 'yes'
const shouldFund = true

// Create Solana SPL token transfer instruction
const tokenMint = new PublicKey(routeTokens[0].token) // USDC on Solana
const recipientAddress = new PublicKey('DTrmsGNtx3ki5PxMwv3maBsHLZ2oLCG7LxqdWFBgBtqh') // Destination wallet
const transferAmount = BigInt(1000)

function encodeTransferCheckedData(amount: bigint | number, decimals: number): Buffer {
  const buf = Buffer.alloc(1 + 8 + 1)
  buf.writeUInt8(12, 0) // 12 = TransferChecked
  buf.writeBigUInt64LE(BigInt(amount), 1)
  buf.writeUInt8(decimals, 1 + 8)
  return buf
}

async function getSolanaTransferCall() {
  // Create SPL token transfer call exactly as in the integration test
  // The integration test uses: spl_token_2022::instruction::transfer_checked()

  // Get the executor and recipient ATAs for the call
  const executorAta = await getAssociatedTokenAddress(tokenMint, solanaPortalAddress, true)
  const recipientAta = await getAssociatedTokenAddress(tokenMint, recipientAddress)

  // Get executor PDA for call accounts
  const EXECUTOR_SEED = Buffer.from('executor')
  const [executorPda] = web3.PublicKey.findProgramAddressSync([EXECUTOR_SEED], solanaPortalAddress)

  // Create the actual SPL token transfer_checked instruction
  // This matches exactly what the integration test does
  // Note: We need to use a function that creates TransferChecked (not Transfer)
  // to match the 4-account requirement

  // Create proper TransferChecked instruction data
  // TransferChecked format: [instruction(1), amount(8), decimals(1)]

  const transferCheckedInstructionData = encodeTransferCheckedData(transferAmount, 6)

  const accounts = [
    { pubkey: executorAta, isSigner: false, isWritable: true }, // executor_ata (source)
    { pubkey: tokenMint, isSigner: false, isWritable: false }, // token mint
    { pubkey: recipientAta, isSigner: false, isWritable: true }, // recipient_ata (destination)
    { pubkey: executorPda, isSigner: false, isWritable: false }, // executor authority
  ]

  // Create the Calldata struct exactly as in the integration test
  const calldata = {
    data: Array.from(transferCheckedInstructionData), // Use the actual instruction data
    account_count: accounts.length, // 4 accounts as per integration test
  }

  // Serialize the Calldata struct using Borsh format
  // Based on Rust struct: { data: Vec<u8>, account_count: u8 }
  // Borsh serialization order: data first (with length), then account_count
  const dataLength = calldata.data.length
  const calldataBytes = Buffer.alloc(4 + dataLength + 1)
  let offset = 0

  // Write data length (u32 little-endian for Vec<u8>)
  calldataBytes.writeUInt32LE(dataLength, offset)
  offset += 4

  // Write data bytes
  Buffer.from(calldata.data).copy(calldataBytes, offset)
  offset += dataLength

  // Write account_count (u8) - comes after data in Rust struct
  calldataBytes[offset] = calldata.account_count

  console.log('MADDEN: Serialized calldata bytes:', calldataBytes.toString('hex'))

  const accountsLengthBuffer = Buffer.alloc(4)
  accountsLengthBuffer.writeUInt32LE(accounts.length, 0)

  const accountsBuffer = accounts.map((acc) => {
    // SerializableAccountMeta: { pubkey: [u8; 32], is_signer: bool, is_writable: bool }
    const pubkeyBytes = Buffer.from(acc.pubkey.toBytes())
    const isSignerByte = Buffer.from([acc.isSigner ? 1 : 0])
    const isWritableByte = Buffer.from([acc.isWritable ? 1 : 0])
    return Buffer.concat([pubkeyBytes, isSignerByte, isWritableByte])
  })
  const accountsData = Buffer.concat(accountsBuffer)

  const serializedCalldata = Buffer.concat([calldataBytes, accountsLengthBuffer, accountsData])

  return {
    target: TOKEN_PROGRAM_ID, // SPL Token program
    data: `0x${serializedCalldata.toString('hex')}` as `0x${string}`,
    value: 0n, // No SOL value for SPL token transfers
  }
}

async function publishOptimismToSolanaIntent(fundIntent: boolean = false) {
  const solanaTransferCall = await getSolanaTransferCall()

  const route: RouteType<VmType.SVM> = {
    vm: VmType.SVM,
    salt: salt,
    deadline: BigInt(now + deadlineWindow), // 2 hours from now
    portal: solanaPortalAddress,
    nativeAmount: 0n,
    tokens: routeTokens.map((token) => ({
      token: new PublicKey(token.token),
      amount: BigInt(token.amount),
    })),
    calls: [solanaTransferCall],
  }

  // Create the intent
  const intent: IntentType = {
    destination: BigInt(config.intentSources[0].chainID), // Solana chain ID
    source: BigInt(config.intentSources[1].chainID), // Optimism chain ID
    route: route,
    reward: reward,
  }

  //   const hashed = hashIntent(intent.destination, intent.route, intent.reward)

  console.log('Intent Details:')
  console.log(`Source Chain (Optimism): ${intent.source}`)
  console.log(`Destination Chain (Solana): ${intent.destination}`)
  console.log(`Route deadline: ${new Date(Number(route.deadline) * 1000).toISOString()}`)
  console.log(`Reward deadline: ${new Date(Number(reward.deadline) * 1000).toISOString()}`)
  console.log(`Creator: ${account.address}`)
  console.log(`Native reward: ${Number(reward.nativeAmount) / 1e18} ETH`)
  console.log(`Route tokens: ${route.tokens.length}`)
  console.log(`Reward tokens: ${reward.tokens.length}`)
  console.log(`Route token amount: ${Number(route.tokens[0].amount) / 1e6} USDC`)
  console.log(`Reward token amount: ${Number(reward.tokens[0].amount) / 1e6} USDC`)
  console.log(`\nSolana Transfer Call:`)
  console.log(`  Token: ${tokenMint.toBase58()}`)
  console.log(`  Recipient: ${recipientAddress.toBase58()}`)
  console.log(`  Amount: ${Number(transferAmount) / 1e6} USDC`)
  console.log(`  Instruction Data: ${solanaTransferCall.data}`)

  try {
    // Calculate intent hash
    const intentHash = hashIntent(intent.destination, intent.route, intent.reward)
    console.log(`Intent hash: ${intentHash.intentHash}`)

    const contractAddress = optimismPortalAddress as Address

    if (fundIntent) {
      console.log('Publishing and funding intent...')

      // First, we need to approve the contract to spend our tokens
      const tokenAddress = reward.tokens[0].token
      const tokenAmount = reward.tokens[0].amount

      // Check current allowance first
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address, contractAddress],
      })

      console.log(`Current allowance: ${Number(currentAllowance) / 1e6} USDC`)
      console.log(`Required amount: ${Number(tokenAmount) / 1e6} USDC`)

      // Check token balance
      const tokenBalance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      })

      console.log(`Token balance: ${Number(tokenBalance) / 1e6} USDC`)

      if (tokenBalance < tokenAmount) {
        throw new Error(
          `Insufficient token balance. Have: ${Number(tokenBalance) / 1e6} USDC, Need: ${Number(tokenAmount) / 1e6} USDC`,
        )
      }

      // Only approve if allowance is insufficient
      if (currentAllowance < tokenAmount) {
        console.log(`Approving ${Number(tokenAmount) / 1e6} USDC for contract ${contractAddress}`)

        // ERC20 approve function using viem's built-in ABI
        const approveHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [contractAddress, tokenAmount],
        })

        console.log(`Token approval transaction: ${approveHash}`)

        // Wait for approval confirmation
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
        console.log('Token approval confirmed')

        // Verify the approval worked
        const newAllowance = await publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account.address, contractAddress],
        })
        console.log(`New allowance after approval: ${Number(newAllowance) / 1e6} USDC`)

        if (newAllowance < tokenAmount) {
          throw new Error(
            `Approval failed. Expected: ${Number(tokenAmount) / 1e6} USDC, Got: ${Number(newAllowance) / 1e6} USDC`,
          )
        }
      } else {
        console.log(`Sufficient allowance already exists: ${Number(currentAllowance) / 1e6} USDC`)
      }

      // Now publish and fund the intent
      const { request } = await publicClient.simulateContract({
        account,
        address: contractAddress,
        abi: portalAbi,
        functionName: 'publishAndFund',
        args: [
          intent.destination,
          encodeRoute(intent.route),
          {
            deadline: reward.deadline,
            creator: reward.creator,
            prover: reward.prover,
            nativeAmount: reward.nativeAmount,
            tokens: reward.tokens,
          },
          false, // allowPartial
        ],
        value: reward.nativeAmount,
      })

      const hash = await walletClient.writeContract(request)
      console.log(`Intent published and funded! Transaction hash: ${hash}`)

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`)

      return {
        publishAndFundHash: hash,
        intentHash: intentHash.intentHash,
        blockNumber: receipt.blockNumber,
      }
    } else {
      console.log('Publishing intent only (no funding)...')

      const { request } = await publicClient.simulateContract({
        account,
        address: contractAddress,
        abi: portalAbi,
        functionName: 'publish',
        args: [
          intent.destination,
          encodeRoute(intent.route),
          {
            deadline: reward.deadline,
            creator: reward.creator,
            prover: reward.prover,
            nativeAmount: reward.nativeAmount,
            tokens: reward.tokens,
          },
        ],
      })

      const hash = await walletClient.writeContract(request)
      console.log(`Intent published! Transaction hash: ${hash}`)

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`)

      return {
        publishHash: hash,
        intentHash: intentHash.intentHash,
        blockNumber: receipt.blockNumber,
      }
    }
  } catch (error) {
    console.error('Transaction failed:', error)
    throw error
  }
}

// Run the script
// Usage: npx ts-node scripts/publish-optimism-to-solana-intent.ts
// Usage with funding: npx ts-node scripts/publish-optimism-to-solana-intent.ts --fund yes
console.log(`Running with funding: ${shouldFund}`)
publishOptimismToSolanaIntent(shouldFund).catch(console.error)
