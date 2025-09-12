#!/usr/bin/env ts-node

import { AnchorProvider, BN, Program, Wallet, web3 } from '@coral-xyz/anchor'
import { Buffer } from 'buffer'
import * as dotenv from 'dotenv'
import { encodeAbiParameters, encodeFunctionData, Hex } from 'viem'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { VmType } from '@/eco-configs/eco-config.types'
import { hashIntentSvm, IntentType, RewardType, RouteType } from '@/utils/encodeAndHash'

import config from '../config/solana'
import { getChainConfig } from '@/eco-configs/utils'
import { RouteStruct } from '@/intent/abi'
import { getVaultPda } from '@/intent/check-funded-solana'

// Use Anchor's bundled web3.js to avoid type conflicts
const { Connection, Keypair, PublicKey, ComputeBudgetProgram } = web3

// Load environment variables from .env file
dotenv.config()

// Import the Portal IDL JSON
const portalIdl = require('../src/solana/program/portal.json')

interface TokenAmount {
  token: string
  amount: number
}

interface Call {
  target: Hex // address
  data: Hex // bytes (hex string)
  value: bigint // uint256
}

const deadlineWindow = 7200 // 2 hours

// Helper function to confirm transaction without WebSocket subscription
async function confirmTransactionPolling(
  connection: web3.Connection,
  signature: string,
  commitment: web3.Commitment = 'confirmed',
): Promise<void> {
  const maxRetries = 30 // 30 seconds with 1 second intervals
  let retries = 0

  while (retries < maxRetries) {
    try {
      const result = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      })

      if (
        result?.value?.confirmationStatus === commitment ||
        result?.value?.confirmationStatus === 'finalized'
      ) {
        if (result.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`)
        }
        console.log(`Transaction confirmed with ${result.value.confirmationStatus} commitment`)
        return
      }

      if (result?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`)
      }
    } catch (error) {
      if (retries === maxRetries - 1) {
        throw error
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
    retries++
  }

  throw new Error(`Transaction confirmation timeout after ${maxRetries} seconds`)
}

// Parse command line arguments
const args = process.argv.slice(2)
const shouldFund = args.includes('--fund') && args[args.indexOf('--fund') + 1] === 'yes'

async function publishSolanaIntent(fundIntent: boolean = false) {
  console.log('Publishing Solana Intent...')

  // Set up connection to Solana cluster (with subscription disabled)
  const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  const connection = new Connection(solanaRpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    wsEndpoint: undefined,
    confirmTransactionInitialTimeout: 60000,
  })

  // Load keypair from environment variable
  let keypair
  const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY

  if (privateKeyEnv) {
    try {
      const privateKeyArray = JSON.parse(privateKeyEnv)
      keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray))
      console.log(`Loaded keypair from SOLANA_PRIVATE_KEY: ${keypair.publicKey.toString()}`)
    } catch (error) {
      console.error('Failed to parse SOLANA_PRIVATE_KEY as JSON array')
      throw error
    }
  } else {
    throw new Error('SOLANA_PRIVATE_KEY environment variable not found')
  }

  // Create sample route and intent data
  const now = Math.floor(Date.now() / 1000)

  // Generate salt as 32-byte hex string directly from timestamp
  const salt = `0x${now.toString(16).padStart(64, '0')}` as `0x${string}`

  // Portal address as 32-byte array
  const portalPubkey = new PublicKey(getChainConfig(1399811149).Inbox)
  const optimismPortalAddress = getChainConfig(10).Inbox

  // Sample token amounts for the route
  const routeTokens: TokenAmount[] = [
    {
      token: config.intentSources[1].tokens[0], // USDC on Optimism
      amount: 10_000, // 0.01 USDC (6 decimals)
    },
  ]

  // Create reward tokens
  const rewardTokens: TokenAmount[] = [
    {
      token: config.intentSources[0].tokens[0], // USDC on Solana
      amount: 45_000, // 0.01 USDC reward (6 decimals)
    },
  ]

  // Create the reward
  const reward: RewardType<VmType.SVM> = {
    vm: VmType.SVM,
    deadline: BigInt(now + deadlineWindow), // 2 hours from now
    creator: keypair.publicKey,
    prover: new PublicKey(getChainConfig(1399811149).HyperProver),
    nativeAmount: 0n,
    tokens: rewardTokens.map((token) => ({
      token: new PublicKey(token.token),
      amount: BigInt(token.amount),
    })),
  }
  // Create the intent first to get destination
  const intent: IntentType = {
    destination: BigInt(config.intentSources[1].chainID), // Optimism chain ID
    source: BigInt(config.intentSources[0].chainID), // Solana chain ID
    route: {} as RouteType<VmType.EVM>, // Will be filled below
    reward: reward,
  }

  // Get target address and selector from config for destination chain
  const destinationSolvers = config.solvers[Number(intent.destination)]
  if (!destinationSolvers) {
    throw new Error(`No solvers config found for chain ID ${intent.destination}`)
  }

  // Get the first target address and its first selector
  const targetAddresses = Object.keys(destinationSolvers.targets)
  if (targetAddresses.length === 0) {
    throw new Error(`No target addresses found for chain ID ${intent.destination}`)
  }

  const targetAddress = targetAddresses[0]

  const sampleCall: Call = {
    target: targetAddress as `0x${string}`,
    data: encodeFunctionData({
      abi: [
        {
          name: 'transfer',
          type: 'function',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
        },
      ],
      functionName: 'transfer',
      args: ['0xb1b4e269dD0D19d9D49f3a95bF6c2c15f13E7943', BigInt(10000)],
    }),
    value: 0n,
  }

  // Create the route
  const route: RouteType<VmType.EVM> = {
    vm: VmType.EVM,
    salt: salt,
    deadline: BigInt(now + deadlineWindow), // 2 hours from now
    portal: optimismPortalAddress as Hex,
    nativeAmount: 0n,
    tokens: routeTokens.map((token) => ({
      token: token.token as Hex,
      amount: BigInt(token.amount),
    })),
    calls: [sampleCall],
  }

  // Update the intent with the route
  intent.route = route

  console.log('Intent Details:')
  console.log(`Destination Chain: ${intent.destination}`)
  console.log(`Route deadline: ${new Date(Number(route.deadline) * 1000).toISOString()}`)
  console.log(`Reward deadline: ${new Date(Number(reward.deadline) * 1000).toISOString()}`)
  console.log(`Creator: ${keypair.publicKey.toString()}`)
  console.log(`Native reward: ${Number(reward.nativeAmount) / 1e9} SOL`)
  console.log(`Route tokens: ${route.tokens.length}`)
  console.log(`Reward tokens: ${reward.tokens.length}`)

  // Build and send the transaction
  console.log('Building transaction...')

  try {
    // Set up Anchor Provider and Portal Program
    const wallet = new Wallet(keypair)
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
      skipPreflight: false,
      maxRetries: 3,
    })

    console.log('Setting up program with provided IDL...')
    let program
    try {
      const fetchedIdl = await Program.fetchIdl(portalPubkey, provider)
      if (!fetchedIdl) {
        throw new Error('No IDL found on-chain')
      }
      console.log('IDL fetched from chain successfully')
      program = new Program(fetchedIdl, provider)
    } catch (idlError) {
      console.log('Could not fetch IDL from chain, using provided IDL')
      program = new Program(portalIdl, provider)
    }

    // Prepare Portal program types with BN for numeric fields
    // Ensure tokens array is properly formatted for Borsh encoding
    const portalReward = {
      deadline: new BN(reward.deadline),
      creator: new PublicKey(reward.creator),
      prover: new PublicKey(reward.prover),
      nativeAmount: new BN(reward.nativeAmount),
      tokens: Array.from(
        reward.tokens.map((token) => ({
          token: new PublicKey(token.token),
          amount: new BN(token.amount),
        })),
      ),
    }

    console.log('Publishing intent...')

    // Replace the encodeRoute call with this manual encoding using the exact ABI structure
    const routeBytes = Buffer.from(
      encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: RouteStruct,
          },
        ],
        [
          {
            salt: salt,
            deadline: route.deadline,
            portal: route.portal,
            nativeAmount: 0n,
            tokens: route.tokens,
            calls: route.calls,
          },
        ],
      ).slice(2), // remove 0x prefix
      'hex',
    )

    // Build the transaction manually to avoid Anchor's WebSocket subscription
    const transaction = await program.methods
      .publish({
        destination: new BN(intent.destination),
        route: routeBytes,
        reward: portalReward,
      })
      .accounts({})
      .transaction()

    // Send the transaction manually
    console.log('Sending publish transaction...')
    const signature = await connection.sendTransaction(transaction, [keypair], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    })

    console.log(`Intent published! Transaction signature: ${signature}`)
    console.log('Confirming transaction...')

    // Manually confirm the transaction using polling instead of WebSocket subscription
    await confirmTransactionPolling(connection, signature, 'confirmed')

    console.log(`Intent published and confirmed! Transaction: ${signature}`)

    const intentHash = hashIntentSvm(BigInt(intent.destination), intent.route, intent.reward)

    console.log('JUSTLOGGING: intent', BigInt(intent.destination), intent.route)

    // Conditionally fund the intent if requested
    let fundingSignature: string | null = null
    if (fundIntent) {
      console.log('Funding the published intent...')

      try {
        // Calculate vault PDA from intent hash
        const intentHashBytes = new Uint8Array(Buffer.from(intentHash.intentHash.slice(2), 'hex'))
        const [vaultPda] = getVaultPda(intentHashBytes)

        console.log(`Intent hash: ${intentHash.intentHash}`)
        console.log(
          `Intent hash bytes: ${Array.from(intentHashBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')}`,
        )
        console.log(`Vault PDA: ${vaultPda.toString()}`)

        // Get token accounts for funding (matching Rust implementation)
        const tokenMint = new PublicKey(reward.tokens[0].token) // USDC mint
        const funderTokenAccount = await getAssociatedTokenAddress(tokenMint, keypair.publicKey)

        // For PDA vault, we need to use allowOwnerOffCurve: true
        const vaultTokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          vaultPda,
          true, // allowOwnerOffCurve for PDA
        )

        const routeHashBytes = new Uint8Array(Buffer.from(intentHash.routeHash.slice(2), 'hex'))

        // Prepare token transfer accounts
        const tokenTransferAccounts = [
          { pubkey: funderTokenAccount, isWritable: true, isSigner: false },
          { pubkey: vaultTokenAccount, isWritable: true, isSigner: false },
          { pubkey: tokenMint, isWritable: false, isSigner: false },
        ]

        // Build the funding transaction with exact account ordering matching Rust
        // The Rust code uses to_account_metas() which orders accounts in struct field order
        // In FundArgs, route_hash is directly an array [u8; 32], not a Bytes32 struct
        // Ensure we have exactly 32 bytes and try different formats
        if (routeHashBytes.length !== 32) {
          throw new Error(`Route hash must be exactly 32 bytes, got ${routeHashBytes.length}`)
        }

        const fundArgs = {
          destination: new BN(intent.destination),
          route_hash: routeHashBytes, // Try Uint8Array directly
          reward: portalReward,
          allow_partial: false, // Use snake_case to match Rust
        }

        console.log('MADDEN: remaining accounts', tokenTransferAccounts)

        // Check if funder token account exists, if not create it first
        const funderAccountInfo = await connection.getAccountInfo(funderTokenAccount)
        if (!funderAccountInfo) {
          console.log("MADDEN: Funder token account doesn't exist, creating it...")

          const createFunderTokenAccountIx = await import('@solana/spl-token').then((spl) =>
            spl.createAssociatedTokenAccountInstruction(
              keypair.publicKey, // payer
              funderTokenAccount, // associated token account
              keypair.publicKey, // owner
              tokenMint, // mint
            ),
          )

          // Send create account transaction first
          const createAccountTx = new web3.Transaction().add(createFunderTokenAccountIx)
          const createAccountSig = await connection.sendTransaction(createAccountTx, [keypair], {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3,
          })

          console.log(`Created funder token account: ${createAccountSig}`)
          await confirmTransactionPolling(connection, createAccountSig, 'confirmed')
        } else {
          console.log('MADDEN: Funder token account already exists')
        }

        const fundingTransaction = await program.methods
          .fund(fundArgs)
          .accountsStrict({
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: new PublicKey('11111111111111111111111111111111'),
            token2022Program: TOKEN_2022_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            vault: vaultPda,
            payer: keypair.publicKey,
            funder: keypair.publicKey,
          })
          .remainingAccounts(tokenTransferAccounts)
          .transaction()

        console.log('MADDEN: fundingTransaction', fundingTransaction)

        // HACK: Manually replace the zeros in the instruction data with the actual route hash
        // The route hash should start at byte 16 (after 8-byte discriminator + 8-byte destination)
        const instructionData = Buffer.from(fundingTransaction.instructions[0].data)
        console.log('MADDEN: Original instruction data:', instructionData.toString('hex'))
        console.log(
          'MADDEN: Route hash bytes to insert:',
          Buffer.from(routeHashBytes).toString('hex'),
        )

        // Replace bytes 16-47 (32 bytes) with the actual route hash
        Buffer.from(routeHashBytes).copy(instructionData, 16)

        // Update the instruction data
        fundingTransaction.instructions[0].data = instructionData

        // Send the funding transaction manually (using legacy transaction)
        console.log('Sending funding transaction...')
        fundingSignature = await connection.sendTransaction(fundingTransaction, [keypair], {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        })

        console.log(`Intent funding transaction signature: ${fundingSignature}`)
        console.log('Confirming funding transaction...')

        // Manually confirm the funding transaction
        if (fundingSignature) {
          await confirmTransactionPolling(connection, fundingSignature, 'confirmed')
          console.log(`Intent funded and confirmed! Transaction: ${fundingSignature}`)
        }
      } catch (fundingError) {
        console.error('Failed to fund intent:', fundingError)
        // Don't throw, just log the error so publish still succeeds
      }
    }

    return {
      publishSignature: signature,
      fundingSignature,
      destination: intent.destination,
      routeBytes: routeBytes.toString('hex'),
      reward: portalReward,
    }
  } catch (error) {
    console.error('L Transaction failed:', error)
    throw error
  }
}

// Run the script
// Usage: npx ts-node scripts/publish-solana-intent.ts
// Usage with funding: npx ts-node scripts/publish-solana-intent.ts --fund yes
console.log(`Running with funding: ${shouldFund}`)
publishSolanaIntent(shouldFund).catch(console.error)
