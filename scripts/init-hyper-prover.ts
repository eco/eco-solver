#!/usr/bin/env ts-node

import { Program, AnchorProvider, Wallet, web3, BN } from '@coral-xyz/anchor'
import * as dotenv from 'dotenv'

// Use Anchor's bundled web3.js to avoid type conflicts
const { Connection, Keypair, PublicKey } = web3

// Load environment variables from .env file
dotenv.config()

// Import the Hyper Prover IDL JSON (provided inline for now)
const hyperProverIdl = require('../src/solana/program/hyper_prover.json')

// Helper function to confirm transaction without WebSocket subscription
async function confirmTransactionPolling(connection: web3.Connection, signature: string, commitment: web3.Commitment = 'confirmed'): Promise<void> {
  const maxRetries = 30
  let retries = 0
  
  while (retries < maxRetries) {
    try {
      const result = await connection.getSignatureStatus(signature, { searchTransactionHistory: true })
      
      if (result?.value?.confirmationStatus === commitment || result?.value?.confirmationStatus === 'finalized') {
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
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    retries++
  }
  
  throw new Error(`Transaction confirmation timeout after ${maxRetries} seconds`)
}

// Hardcoded whitelisted sender
const WHITELISTED_SENDER = '0x0000000000000000000000009523b6c0caac8122dbd5dd1c1d336ceba637038d'

function getWhitelistedSenders(): Uint8Array[] {
  const cleanSender = WHITELISTED_SENDER.startsWith('0x') ? WHITELISTED_SENDER.slice(2) : WHITELISTED_SENDER
  if (cleanSender.length !== 64) {
    throw new Error(`Invalid sender length: ${cleanSender.length}, expected 64 hex characters`)
  }
  return [new Uint8Array(Buffer.from(cleanSender, 'hex'))]
}

async function initHyperProver() {
  console.log('Initializing Hyper Prover...')
  
  // Set up connection to Solana cluster
  const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  const connection = new Connection(solanaRpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    wsEndpoint: undefined,
    confirmTransactionInitialTimeout: 60000
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

  // Get hardcoded whitelisted senders
  const whitelistedSenders = getWhitelistedSenders()
  console.log(`Whitelisted sender: ${WHITELISTED_SENDER}`)

  try {
    // Set up Anchor Provider and Program
    const wallet = new Wallet(keypair)
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
      skipPreflight: false,
      maxRetries: 3
    })
    
    const hyperProverProgramId = new PublicKey(hyperProverIdl.address)
    const program = new Program(hyperProverIdl, provider)
    
    console.log(`Hyper Prover Program ID: ${hyperProverProgramId.toString()}`)

    // Derive config PDA (matching Config::pda() from Rust)
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      hyperProverProgramId
    )
    console.log(`Config PDA: ${configPda.toString()}`)

    // Prepare init args with whitelisted senders
    // The IDL expects Bytes32 struct format: { 0: [u8; 32] }
    const initArgs = {
      whitelistedSenders: whitelistedSenders.map(sender => ({
        0: Array.from(sender)
      }))
    }
    
    console.log('Building initialization transaction...')

    // Build the initialization transaction
    const transaction = await program.methods
      .init(initArgs)
      .accounts({
        config: configPda,
        payer: keypair.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction()

    // Send the transaction
    console.log('Sending initialization transaction...')
    const signature = await connection.sendTransaction(transaction, [keypair], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    })
    
    console.log(`Hyper Prover initialization transaction signature: ${signature}`)
    console.log('Confirming transaction...')
    
    // Confirm the transaction
    await confirmTransactionPolling(connection, signature, 'confirmed')
    
    console.log(`Hyper Prover initialized successfully!`)
    console.log(`Config PDA: ${configPda.toString()}`)
    console.log(`Transaction: ${signature}`)
    
    return {
      signature,
      config: configPda.toString(),
      whitelistedSendersCount: whitelistedSenders.length
    }
    
  } catch (error) {
    console.error('Initialization failed:', error)
    throw error
  }
}

// Usage information
console.log('Hyper Prover Initialization Script')
console.log(`Whitelisted sender: ${WHITELISTED_SENDER}`)
console.log('Usage: npx ts-node scripts/init-hyper-prover.ts')
console.log('')

// Run the script
initHyperProver().catch(console.error)