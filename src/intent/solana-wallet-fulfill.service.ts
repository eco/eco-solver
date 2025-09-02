import { Injectable, Logger } from '@nestjs/common'
import { Hex } from 'viem'
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token'
import { Buffer } from 'buffer'
import { Program, AnchorProvider, Wallet, BN, web3 } from '@coral-xyz/anchor'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Solver, VmType } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeeService } from '@/fee/fee.service'
import { ProofService } from '@/prover/proof.service'
import { UtilsIntentService } from './utils-intent.service'
import { IFulfillService } from '@/intent/interfaces/fulfill-service.interface'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { getChainConfig } from '@/eco-configs/utils'
import { SvmMultichainClientService } from '@/transaction/svm-multichain-client.service'
import { CallDataInterface } from '@/contracts'
import { hashIntent, encodeRoute } from '@/utils/encodeAndHash'

import * as portalIdl from '../solana/program/portal.json'
import * as hyperProverIdl from '../solana/program/hyper_prover.json'

/**
 * This class fulfills Solana intents by creating and executing transactions on Solana.
 */
@Injectable()
export class SolanaWalletFulfillService implements IFulfillService {
  private logger = new Logger(SolanaWalletFulfillService.name)

  constructor(
    private readonly svmClientService: SvmMultichainClientService,
    private readonly feeService: FeeService,
    private readonly utilsIntentService: UtilsIntentService,
  ) {}

  /**
   * Fulfills a Solana intent by executing the necessary transactions.
   * This includes transferring tokens and calling the fulfill function on the portal contract.
   */
  async fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex> {
    try {
      // Get Solana connection and keypair
      const connection = await this.svmClientService.getConnection(solver.chainID)
      const keypair = await this.getSolverKeypair()
      
      // Final feasibility check
      await this.finalFeasibilityCheck(model.intent)

      // Create and send the fulfill transaction
      const txSignature = await this.executeFulfillment(
        new web3.Connection(connection.rpcEndpoint), // TODO: decide one way or the other
        keypair,
        model,
        solver
      )

      // Update model status
      model.status = 'SOLVED'
      model.receipt = { 
        transactionHash: txSignature,
        status: 'success',
        blockNumber: 0n, // Will be updated when we get the slot
      } as any

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Fulfilled Solana transaction ${txSignature}`,
          properties: {
            transactionHash: txSignature,
            destinationChainID: model.intent.route.destination,
            sourceChainID: IntentSourceModel.getSource(model),
          },
        }),
      )

      return `0x${Buffer.from(txSignature).toString('hex')}` as Hex
    } catch (error) {
      model.status = 'FAILED'
      model.receipt = error

      this.logger.error(
        EcoLogMessage.withError({
          message: `Solana fulfillment failed`,
          error: error as Error,
          properties: {
            model: model,
            error: error,
          },
        }),
      )

      throw error
    } finally {
      // Update the db model
      await this.utilsIntentService.updateIntentModel(model)
    }
  }

  /**
   * Executes the fulfillment transaction on Solana
   */
  private async executeFulfillment(
    connection: web3.Connection,
    keypair: web3.Keypair,
    model: IntentSourceModel,
    solver: Solver
  ): Promise<string> {
    const transaction = new web3.Transaction()
    
    // Add token transfer instructions if needed
    const transferInstructions = await this.createTokenTransferInstructions(
      connection,
      keypair,
      model,
      solver
    )
    console.log("MADDEN: transferInstructions", transferInstructions)
    transaction.add(...transferInstructions)

    // Add fulfill instruction
    const fulfillInstruction = await this.createFulfillInstruction(
      connection,
      keypair,
      model,
      solver
    )
    transaction.add(fulfillInstruction)

    // Send and confirm transaction
    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    )

    return signature
  }

  /**
   * Creates token transfer instructions for the intent's route tokens
   */
  private async createTokenTransferInstructions(
    connection: web3.Connection,
    keypair: web3.Keypair,
    model: IntentSourceModel,
    solver: Solver
  ): Promise<web3.TransactionInstruction[]> {
    const instructions: web3.TransactionInstruction[] = []
    
    // Process each call in the route
    for (const call of model.intent.route.calls) {
      // Check if this is an SPL token transfer
      if (this.isSPLTokenTransfer(call)) {
        console.log("MADDEN: isSPLTokenTransfer called for solana", call)
        const instruction = await this.createSPLTransferInstruction(
          connection,
          keypair,
          call,
          model
        )
        if (instruction) {
          instructions.push(instruction)
        }
      }
    }

    return instructions
  }

  /**
   * Checks if a call is an SPL token transfer
   */
  private isSPLTokenTransfer(call: CallDataInterface): boolean {
    console.log("MADDEN: isSPLTokenTransfer called for solana", call)
    const targetString = call.target.toString()
    const tokenProgramId = TOKEN_PROGRAM_ID.toBase58()
    
    if (targetString === tokenProgramId || targetString.toLowerCase() === tokenProgramId.toLowerCase()) {
      const dataHex = call.data as string
      const dataBytes = Buffer.from(dataHex.slice(2), 'hex')
      
      // Check if it's a transfer instruction (instruction type 3)
      return dataBytes.length >= 9 && dataBytes[0] === 3
    }
    
    return false
  }

  /**
   * Creates an SPL token transfer instruction
   */
  private async createSPLTransferInstruction(
    connection: web3.Connection,
    keypair: web3.Keypair,
    call: CallDataInterface,
    model: IntentSourceModel
  ): Promise<web3.TransactionInstruction | null> {
    try {
      // Decode the transfer amount from the call data
      const dataHex = call.data as string
      const dataBytes = Buffer.from(dataHex.slice(2), 'hex')
      const amount = dataBytes.readBigUInt64LE(1)

      console.log("MADDEN: createSPLTransferInstruction amount", amount)
      
      const routeToken = model.intent.route.tokens[0] // assuming first token for now
      const tokenMint = new web3.PublicKey(routeToken.token)
      console.log("MADDEN: createSPLTransferInstruction tokenMint", tokenMint)
      
      // Get source and destination token accounts
      const sourceTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        keypair.publicKey
      )
      console.log("MADDEN: createSPLTransferInstruction sourceTokenAccount", sourceTokenAccount)
      
      // For now, use a placeholder recipient - this should come from the intent
      const recipientPubkey = new web3.PublicKey('DTrmsGNtx3ki5PxMwv3maBsHLZ2oLCG7LxqdWFBgBtqh')
      const destinationTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        recipientPubkey
      )
      console.log("MADDEN: createSPLTransferInstruction destinationTokenAccount", destinationTokenAccount)
      
      // Check if destination token account exists, create if not
      const destAccountInfo = await connection.getAccountInfo(destinationTokenAccount)
      if (!destAccountInfo) {
        // Return instruction to create the associated token account
        return createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          destinationTokenAccount,
          recipientPubkey,
          tokenMint
        )
      }
      
      // Create the transfer instruction
      return createTransferInstruction(
        sourceTokenAccount,
        destinationTokenAccount,
        keypair.publicKey,
        Number(amount)
      )
    } catch (error) {
      this.logger.error('Failed to create SPL transfer instruction:', error)
      return null
    }
  }

  /**
   * Creates the fulfill instruction for the portal contract
   */
  private async createFulfillInstruction(
    connection: web3.Connection,
    keypair: web3.Keypair,
    model: IntentSourceModel,
    solver: Solver
  ): Promise<web3.TransactionInstruction> {
    const portalAddress = new web3.PublicKey(getChainConfig(Number(model.intent.route.destination)).Inbox)
    
    // Set up Anchor provider and program
    // Create wallet from keypair for Anchor
    const wallet = new Wallet(web3.Keypair.fromSecretKey(keypair.secretKey))
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    })
    
    console.log("MADDEN: destination", model.intent.destination)
    console.log("MADDEN: intent.reward", model.intent.reward)
    console.log("MADDEN: intent.route", model.intent.route)
    const program = new Program(portalIdl, provider)
    
    // Get the intent hash
    const { intentHash, rewardHash } = hashIntent(
      model.intent.destination,
      model.intent.route,
      model.intent.reward
    )
    const intentHashBytes = Buffer.from(intentHash.slice(2), 'hex')
    const rewardHashBytes = Buffer.from(rewardHash.slice(2), 'hex')
    
    // Get executor PDA - matches executor_pda() in Rust
    const EXECUTOR_SEED = Buffer.from("executor")
    const [executorPda] = web3.PublicKey.findProgramAddressSync(
      [EXECUTOR_SEED],
      portalAddress
    )
    
    // Get fulfill marker PDA - matches FulfillMarker::pda() in Rust
    const FULFILL_MARKER_SEED = Buffer.from("fulfill_marker")
    const [fulfillMarkerPda] = web3.PublicKey.findProgramAddressSync(
      [FULFILL_MARKER_SEED, intentHashBytes],
      portalAddress
    )
    
    // Convert claimant address to Bytes32 format (32-byte array)
    const claimantBytes = keypair.publicKey.toBytes()
    const claimantBytes32 = new Uint8Array(32)
    claimantBytes32.set(claimantBytes)

    console.log("MADDEN: encodeRoute", encodeRoute(model.intent.route))
    
    // Prepare fulfill arguments matching the Rust struct
    const encodedRoute = encodeRoute(model.intent.route)
    const routeBytes = Buffer.from(encodedRoute.slice(2), 'hex') // Convert hex to bytes
    
    // Try using the route struct directly instead of encoded bytes
    const fulfillArgs = {
      intentHash: { 0: Array.from(intentHashBytes) }, // Bytes32 format
      route: {
        salt: { 0: Array.from(Buffer.from(model.intent.route.salt.slice(2), 'hex')) },
        deadline: new BN(model.intent.route.deadline.toString()),
        portal: { 0: Array.from(new web3.PublicKey(model.intent.route.portal).toBytes()) },
        tokens: model.intent.route.tokens.map(({ token, amount }) => ({
          token: new web3.PublicKey(token),
          amount: new BN(amount.toString())
        })),
        calls: model.intent.route.calls.map(({ target, data, value }) => ({
          target: { 0: Array.from(new web3.PublicKey(target).toBytes()) },
          data: Buffer.from(data.slice(2), 'hex'),
          value: new BN(value.toString())
        }))
      },
      rewardHash: { 0: Array.from(rewardHashBytes) }, // Bytes32 format
      claimant: { 0: Array.from(claimantBytes32) }, // Bytes32 format
    }
    
    // Get remaining accounts for token transfers and calls
    const remainingAccounts = await this.getTokenTransferAccounts(
      connection,
      keypair,
      model.intent.route
    )
    
    // Build the fulfill instruction matching the Rust accounts structure
    const instruction = await program.methods
      .fulfill(fulfillArgs)
      .accounts({
        payer: keypair.publicKey,
        solver: keypair.publicKey,
        executor: executorPda,
        fulfillMarker: fulfillMarkerPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: new web3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .instruction()
    
    console.log("MADDEN: fulfillInstruction original data", instruction.data.toString('hex'))
    console.log("MADDEN: routeBytes to insert", routeBytes.toString('hex'))
    console.log("MADDEN: intentHashBytes", intentHashBytes.toString('hex'))
    console.log("MADDEN: rewardHashBytes", rewardHashBytes.toString('hex'))
    
    console.log("MADDEN: fulfillInstruction with route struct", instruction.data.toString('hex'))
    
    return instruction
  }
  
  /**
   * Gets the remaining accounts needed for token transfers
   * Matches the token_transfer_and_call_accounts logic in Rust
   */
  private async getTokenTransferAccounts(
    connection: web3.Connection,
    keypair: web3.Keypair,
    route: any
  ): Promise<web3.AccountMeta[]> {
    console.log("MADDEN: getTokenTransferAccounts - route.tokens:", route.tokens)
    console.log("MADDEN: getTokenTransferAccounts - route.calls:", route.calls)
    const accounts: web3.AccountMeta[] = []
    
    // Add accounts for each token transfer
    // This needs to match VecTokenTransferAccounts structure from Rust
    for (const token of route.tokens || []) {
      const tokenMint = new web3.PublicKey(token.token)
      
      // Source token account (solver's)
      const sourceTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        keypair.publicKey
      )
      
      // Destination would be the executor PDA
      const EXECUTOR_SEED = Buffer.from("executor")
      const [executorPda] = web3.PublicKey.findProgramAddressSync(
        [EXECUTOR_SEED],
        new web3.PublicKey(portalIdl.address)
      )
      
      const destTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        executorPda,
        true // Allow PDA owner
      )
      
      // Add accounts in the order expected by the Rust TokenTransferAccounts struct:
      // [from, to, mint] - exactly 3 accounts per token
      accounts.push(
        { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // from
        { pubkey: destTokenAccount, isSigner: false, isWritable: true },   // to  
        { pubkey: tokenMint, isSigner: false, isWritable: false }          // mint
      )
    }
    
    console.log("MADDEN: getTokenTransferAccounts - token accounts:", accounts.length)
    console.log("MADDEN: getTokenTransferAccounts - expected for tokens:", route.tokens.length, "* 3 (VEC_TOKEN_TRANSFER_ACCOUNTS_CHUNK_SIZE)")
    
    // Add accounts for calls - these should be separate from token accounts
    const callAccounts: web3.AccountMeta[] = []
    
    // Get executor PDA for call accounts
    const EXECUTOR_SEED = Buffer.from("executor")
    const [executorPda] = web3.PublicKey.findProgramAddressSync(
      [EXECUTOR_SEED],
      new web3.PublicKey(portalIdl.address)
    )
    
    for (const call of route.calls || []) {
      console.log("MADDEN: Processing call:", call)
      console.log("MADDEN: Call target:", call.target)
      console.log("MADDEN: Call data:", call.data)
      
      // Try to decode the call data to understand its format
      const callDataBytes = Buffer.from(call.data.slice(2), 'hex')
      console.log("MADDEN: Call data bytes:", callDataBytes)
      console.log("MADDEN: Call data length:", callDataBytes.length)
      console.log("MADDEN: First byte (should be account_count):", callDataBytes[0])
      console.log("MADDEN: Remaining bytes (instruction data):", callDataBytes.slice(1))
      
      //for token transfer calls we need 4 accounts:
      // 1. executor_ata (source) - writable
      // 2. token mint - read-only  
      // 3. recipient_ata (destination) - writable
      // 4. executor PDA (authority) - read-only
      
      // Add all the call accounts as per the integration test pattern
      // The memory issue might be from missing required accounts, not too many accounts
      
      // For each token in the route, we need to provide call accounts
      for (const token of route.tokens || []) {
        const tokenMint = new web3.PublicKey(token.token)
        
        // Executor's associated token account (source)
        const executorAta = await getAssociatedTokenAddress(
          tokenMint,
          executorPda,
          true // Allow PDA owner
        )
        
        // Recipient's associated token account (destination)
        // For now, using the solver's address as recipient - this should be parsed from call data
        const recipientPubkey = keypair.publicKey 
        const recipientAta = await getAssociatedTokenAddress(
          tokenMint,
          recipientPubkey
        )
        
        // Add the 4 accounts needed for the call (matching integration test)
        callAccounts.push(
          { pubkey: executorAta, isSigner: false, isWritable: true },      // executor_ata (source)
          { pubkey: tokenMint, isSigner: false, isWritable: false },       // token mint
          { pubkey: recipientAta, isSigner: false, isWritable: true },     // recipient_ata (destination)
          { pubkey: executorPda, isSigner: false, isWritable: false }      // executor authority
        )
        
        console.log("MADDEN: Added call accounts for token:", tokenMint.toString())
        console.log("  - executorAta:", executorAta.toString())
        console.log("  - tokenMint:", tokenMint.toString())
        console.log("  - recipientAta:", recipientAta.toString())
        console.log("  - executorPda:", executorPda.toString())
      }
    }
    
    console.log("MADDEN: getTokenTransferAccounts - call accounts:", callAccounts.length)
    console.log("MADDEN: getTokenTransferAccounts - total accounts:", accounts.length + callAccounts.length)
    console.log("MADDEN: getTokenTransferAccounts - token accounts:", accounts.map(acc => acc.pubkey.toString()))
    console.log("MADDEN: getTokenTransferAccounts - call accounts:", callAccounts.map(acc => acc.pubkey.toString()))
    
    // Return token accounts + call accounts in the correct order
    return [...accounts, ...callAccounts]
  }

  /**
   * Gets the solver's Solana keypair from environment
   */
  private async getSolverKeypair(): Promise<web3.Keypair> {
    const privateKeyStr = process.env.SOLANA_PRIVATE_KEY
    if (!privateKeyStr) {
      throw new Error('SOLANA_PRIVATE_KEY not found in environment')
    }
    
    try {
      const privateKey = JSON.parse(privateKeyStr)
      return web3.Keypair.fromSecretKey(new Uint8Array(privateKey))
    } catch (error) {
      throw new Error('Failed to parse SOLANA_PRIVATE_KEY')
    }
  }

  /**
   * Performs final feasibility check before fulfillment
   */
  private async finalFeasibilityCheck(intent: IntentDataModel) {
    const { error } = await this.feeService.isRouteFeasible(intent)
    if (error) {
      throw error
    }
  }
}