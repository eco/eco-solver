#!/usr/bin/env ts-node

import { Program, AnchorProvider, Wallet, web3, BN } from '@coral-xyz/anchor'

// Use Anchor's bundled web3.js to avoid type conflicts
const { Connection, Keypair, PublicKey, SystemProgram } = web3
import * as crypto from 'crypto'
import * as dotenv from 'dotenv'
import { encodeAbiParameters, encodeFunctionData } from 'viem'
import { InboxAbi, EcoProtocolAddresses, RouteType, encodeRoute } from '@eco-foundation/routes-ts'
import config from '../config/solana'

// Load environment variables from .env file
dotenv.config()

// Import the Portal IDL JSON
const portalIdl = require('../src/solana/program/portal.json')

interface TokenAmount {
  token: string
  amount: number
}

interface Reward {
  deadline: number
  creator: string
  prover: string
  native_amount: number
  tokens: TokenAmount[]
}

interface Call {
  target: string // address
  data: string   // bytes (hex string)
  value: number  // uint256
}

interface Route {
  salt: number[]
  deadline: number
  portal: number[]
  tokens: TokenAmount[]
  calls: Call[]
}

interface Intent {
  destination: number
  route: Route
  reward: Reward
}

async function publishSolanaIntent() {
  console.log('Publishing Solana Intent...')
  
  // Set up connection to Solana cluster (with subscription disabled)
  const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(solanaRpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    wsEndpoint: undefined // Disable WebSocket to avoid subscription errors
  })
  
  // Load keypair from environment variable
  let keypair
  const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY
  
  if (privateKeyEnv) {
    try {
      // Parse the private key as a JSON array of numbers
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
  
  // Generate random salt (32 bytes)
  const salt = Array.from(Buffer.from(now.toString()))
  
  // Portal address as 32-byte array
  const portalPubkey = new PublicKey('64Xrmg8iLpvW6ohBcjubTqXe56iNYqRi52yrnMfnbaA6')
  const portalAddress = Array.from(portalPubkey.toBytes())
  
  // Sample token amounts for the route
  const routeTokens: TokenAmount[] = [
    {
      token: config.intentSources[0].tokens[0], // USDC on Solana
      amount: 1_000_000 // 1 USDC (6 decimals)
    }
  ]

  // Create reward tokens
  const rewardTokens: TokenAmount[] = [
    {
      token: config.intentSources[0].tokens[0], // USDC on Solana
      amount: 100_000 // 0.1 USDC reward (6 decimals)
    }
  ]

  // Create the reward
  const reward: Reward = {
    deadline: now + 3600, // 1 hour from now
    creator: keypair.publicKey.toString(),
    prover: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Placeholder prover address
    native_amount: 0, // 0.1 SOL
    tokens: rewardTokens
  }

  // Create the intent first to get destination
  const intent: Intent = {
    destination: config.intentSources[1].chainID, // Optimism chain ID
    route: {} as Route, // Will be filled below
    reward: reward
  }

  // Get target address and selector from config for destination chain
  const destinationSolvers = config.solvers[intent.destination];
  if (!destinationSolvers) {
    throw new Error(`No solvers config found for chain ID ${intent.destination}`);
  }
  
  // Get the first target address and its first selector
  const targetAddresses = Object.keys(destinationSolvers.targets);
  if (targetAddresses.length === 0) {
    throw new Error(`No target addresses found for chain ID ${intent.destination}`);
  }
  
  const targetAddress = targetAddresses[0];
  const targetConfig = destinationSolvers.targets[targetAddress];
  const selector = targetConfig.selectors[0];
  
  // Create proper call data using viem encodeFunctionData
  const callData = encodeFunctionData({
    abi: [{
      name: 'transfer',
      type: 'function',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ]
    }],
    functionName: 'transfer',
    args: [
      '0x0000000000000000000000000000000000000000', // Placeholder recipient
      BigInt(1000000) // 1 USDC (6 decimals)
    ]
  });

  const sampleCall: Call = {
    target: targetAddress, // address as hex string
    data: callData,        // bytes as hex string
    value: 0               // uint256 value
  }

  // Create the route
  const route: Route = {
    salt: salt,
    deadline: now + 7200, // 2 hours from now
    portal: portalAddress,
    tokens: routeTokens,
    calls: [sampleCall]
  }

  // Update the intent with the route
  intent.route = route

  // Calculate route hash
  function keccak256(data: Buffer): Buffer {
    // Note: Using SHA-256 as approximation since keccak256 requires additional library
    // In production, use a proper keccak256 implementation like 'js-sha3'
    return crypto.createHash('sha256').update(data).digest()
  }

  // Serialize route for hashing (simplified - in production, use proper serialization)
  const routeData = Buffer.concat([
    Buffer.from(route.salt),
    Buffer.from(route.deadline.toString()),
    Buffer.from(route.portal)
  ])
  const routeHashBytes = keccak256(routeData).slice(0, 32)
  const routeHash = Array.from(routeHashBytes)

  console.log('Intent Details:')
  console.log(`Destination Chain: ${intent.destination}`)
  console.log(`Route deadline: ${new Date(route.deadline * 1000).toISOString()}`)
  console.log(`Reward deadline: ${new Date(reward.deadline * 1000).toISOString()}`)
  console.log(`Creator: ${keypair.publicKey.toString()}`)
  console.log(`Native reward: ${reward.native_amount / 1e9} SOL`)
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
      skipPreflight: false
    })
    
    // Use the program ID from the IDL
    const programId = new PublicKey('64Xrmg8iLpvW6ohBcjubTqXe56iNYqRi52yrnMfnbaA6')
    
    console.log('Setting up program with provided IDL...')
    let program
    try {
      const fetchedIdl = await Program.fetchIdl(programId, provider)
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
    const portalReward = {
      deadline: new BN(reward.deadline),
      creator: new PublicKey(reward.creator),
      prover: new PublicKey(reward.prover),
      nativeAmount: new BN(reward.native_amount),
      tokens: reward.tokens.map(token => ({
        token: new PublicKey(token.token),
        amount: new BN(token.amount)
      }))
    }
    
    console.log('Publishing intent...')
    
    // ABI encode the route struct using RouteType from eco-foundation/routes-ts
    // This ensures we use the canonical Route struct definition
    
    // Get the proper inbox address for the destination chain
    const destinationChainId = intent.destination;
    const inboxAddress = EcoProtocolAddresses[destinationChainId]?.Inbox;
    if (!inboxAddress) {
      throw new Error(`No inbox address found for chain ID ${destinationChainId}`);
    }
    
    const routeData: RouteType = {
        salt: `0x${now.toString(16).padStart(64, '0')}` as `0x${string}`,
        source: BigInt(config.intentSources[0].chainID), // Source chain ID
        destination: BigInt(intent.destination),
        inbox: inboxAddress as `0x${string}`,
        tokens: route.tokens.map(token => ({
          token: config.intentSources[1].tokens[0] as `0x${string}`, // Use destination chain token (Optimism USDC)
          amount: BigInt(token.amount)
        })),
        calls: route.calls.map(call => ({
          target: targetAddress as `0x${string}`,
          data: callData as `0x${string}`,
          value: BigInt(call.value)
        }))
    }
    
    const routeBytes = Buffer.from(encodeRoute(routeData), 'hex')
    
    // Call the Portal program's publish instruction with new structure
    const signature = await program.methods
      .publish({
        destination: new BN(intent.destination),
        route: routeBytes,
        reward: portalReward
      })
      .accounts({
        // The publish instruction has no accounts according to the IDL
      })
      .rpc({
        commitment: 'confirmed',
        skipPreflight: false
      })
    
    console.log(`Intent published! Transaction: ${signature}`)
    
    return {
      signature,
      destination: intent.destination,
      routeBytes: routeBytes.toString('hex'),
      reward: portalReward
    }
    
  } catch (error) {
    console.error('L Transaction failed:', error)
    throw error
  }
}

// Run the script
// Usage: npx ts-node scripts/publish-solana-intent.ts
publishSolanaIntent().catch(console.error)