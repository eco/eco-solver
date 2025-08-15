#!/usr/bin/env ts-node

import { Program, AnchorProvider, Wallet, web3, BN } from '@coral-xyz/anchor'

// Use Anchor's bundled web3.js to avoid type conflicts
const { Connection, Keypair, PublicKey } = web3
import * as crypto from 'crypto'
import * as dotenv from 'dotenv'
import { encodeAbiParameters, encodeFunctionData, Hex } from 'viem'
import { VmType } from '@/eco-configs/eco-config.types'
import { RouteType, IntentType, RewardType } from '@eco-foundation/routes-ts'

// Note: VmType import from @eco-foundation/routes-ts was failing, using string literals directly
import config from '../config/solana'
import { getChainConfig } from '@/eco-configs/utils'
import { RewardStruct, RouteStruct } from '@/intent/abi'
import { hashIntent } from '@/intent/check-funded-solana'

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
  data: Hex   // bytes (hex string)
  value: bigint  // uint256
}

const deadlineWindow = 7200 // 2 hours

// Parse command line arguments
const args = process.argv.slice(2)
const shouldFund = args.includes('--fund') && args[args.indexOf('--fund') + 1] === 'yes'

async function publishSolanaIntent(fundIntent: boolean = false) {
  console.log('Publishing Solana Intent...')
  
  // Set up connection to Solana cluster (with subscription disabled)
  const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(solanaRpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    wsEndpoint: undefined
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
      amount: 10_000 // 0.01 USDC (6 decimals)
    }
  ]

  // Create reward tokens
  const rewardTokens: TokenAmount[] = [
    {
      token: config.intentSources[0].tokens[0], // USDC on Solana
      amount: 45_000 // 0.01 USDC reward (6 decimals)
    }
  ]

  // Create the reward
  const reward: RewardType<VmType.SVM> = {
    vm: VmType.SVM,
    deadline: BigInt(now + deadlineWindow), // 2 hours from now
    creator: keypair.publicKey,
    prover: new PublicKey('5xMGB1foBXh6HLcpvVtBGEdHznSUnvbHQmvByaaaF8pp'), 
    nativeAmount: 0n, 
    tokens: rewardTokens.map(token => ({
      token: new PublicKey(token.token),
      amount: BigInt(token.amount)
    }))
  }
  // Create the intent first to get destination
  const intent: IntentType = {
    destination: BigInt(config.intentSources[1].chainID), // Optimism chain ID
    source: BigInt(config.intentSources[0].chainID), // Solana chain ID
    route: {} as RouteType<VmType.EVM>, // Will be filled below
    reward: reward
  }

  // Get target address and selector from config for destination chain
  const destinationSolvers = config.solvers[Number(intent.destination)];
  if (!destinationSolvers) {
    throw new Error(`No solvers config found for chain ID ${intent.destination}`);
  }
  
  // Get the first target address and its first selector
  const targetAddresses = Object.keys(destinationSolvers.targets);
  if (targetAddresses.length === 0) {
    throw new Error(`No target addresses found for chain ID ${intent.destination}`);
  }
  
  const targetAddress = targetAddresses[0];

  const sampleCall: Call = {
    target: targetAddress as `0x${string}`,
    data: encodeFunctionData({
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
        '0xb1b4e269dD0D19d9D49f3a95bF6c2c15f13E7943', 
        BigInt(10000) 
      ]
    }),  
    value: 0n
  }

  // Create the route
  const route: RouteType<VmType.EVM> = {
    vm: VmType.EVM,
    salt: salt,
    deadline: BigInt(now + deadlineWindow), // 2 hours from now
    portal: optimismPortalAddress as Hex,
    tokens: routeTokens.map(token => ({
      token: token.token as Hex,
      amount: BigInt(token.amount)
    })),
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
    Buffer.from(route.portal.toString())
  ])
  const routeHashBytes = keccak256(routeData).slice(0, 32)

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
      skipPreflight: false
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
    const portalReward = {
      deadline: new BN(reward.deadline),
      creator: new PublicKey(reward.creator),
      prover: new PublicKey(reward.prover),
      nativeAmount: new BN(reward.nativeAmount),
      tokens: reward.tokens.map(token => ({
        token: new PublicKey(token.token),
        amount: new BN(token.amount)
      }))
    }
    
    console.log('Publishing intent...')
    console.log(route.portal, route.tokens, route.calls)

    // Replace the encodeRoute call with this manual encoding using the exact ABI structure
    const routeBytes = Buffer.from(
      encodeAbiParameters(
        [{
          type: 'tuple',
          components: RouteStruct
        }],
        [{
          salt: salt,
          deadline: route.deadline,
          portal: route.portal,
          tokens: route.tokens,
          calls: route.calls
        }]
      ).slice(2), // remove 0x prefix
      'hex'
    )
    
    // Call the Portal program's publish instruction with new structure
    const signature = await program.methods
      .publish({
        destination: new BN(intent.destination),
        route: routeBytes,
        reward: portalReward
      })
      .accounts({})
      .rpc({
        commitment: 'confirmed',
        skipPreflight: false
      })
    
    console.log(`Intent published! Transaction: ${signature}`)
    
    // Conditionally fund the intent if requested
    let fundingSignature = null
    if (fundIntent) {
      console.log('Funding the published intent...')
      
      try {
        // Calculate intent hash for funding (simplified - should match the actual intent hash calculation)
        const intentHash = hashIntent(BigInt(intent.destination), intent.route, intent.reward)
        
        fundingSignature = await program.methods
          .fund({
            destination: new BN(intent.destination),
            route_hash: intentHash.routeHash,
            reward: portalReward,
            allow_partial: false
          })
          .accounts({
          })
          .rpc({
            commitment: 'confirmed',
            skipPreflight: false
          })
        
        console.log(`Intent funded! Transaction: ${fundingSignature}`)
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
      reward: portalReward
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