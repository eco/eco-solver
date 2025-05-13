import { Injectable, Logger } from '@nestjs/common'
import {
  Connection,
  PublicKey,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { SolanaFulfillService } from '@/intent/solana-fulfill-intent.service'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

export const TOKEN_ACCOUNT_CREATTION_LAMPORTS: number = 203_928 // lamports needed to create a new token account

export interface SimulationResult {
  solverLamports: bigint // solver balance
  solverTokenAmounts: Record<string, bigint> // solver token balances
  lamportsOut: bigint // fees + CPI lamports
  tokenOut: Record<string, bigint> // mint -> ui outflows
}

@Injectable()
export class SolanaCostService {
  private readonly logger = new Logger(SolanaCostService.name)

  constructor(
    private readonly connection: Connection,
    private readonly fulfillBuilder: SolanaFulfillService,
  ) {}

  /**
   * Builds a dummy Solana fulfill transaction and simulates it
   * via `connection.simulateTransaction`.
   *
   * Returns lamport cost + token delta map. Throws if simulation errors.
   */
  async simulateIntent(intent: IntentDataModel, solverKey: PublicKey): Promise<SimulationResult> {
    this.logger.debug(`Simulating SVM intent ${intent} with ${intent.route.calls.length} calls`)
    const fulfillInstructions = await this.fulfillBuilder.buildFulfillIntentIxs(
      intent,
      solverKey,
      this.connection,
    )

    const routeMints = intent.route.tokens.map(
      (tokenAmount) => new PublicKey(this.fulfillBuilder.hex32ToBuf(tokenAmount.token)),
    )
    const solverAtas = routeMints.map((mint) => getAssociatedTokenAddressSync(mint, solverKey))
    const accountsConfig = {
      encoding: 'base64' as const,
      addresses: [solverKey.toBase58(), ...solverAtas.map((address) => address.toBase58())],
    }

    const solverAccountInfo = await this.connection.getAccountInfo(solverKey)
    if (!solverAccountInfo) {
      throw new Error(`Simulation failed: couldn't get solver account info`)
    }

    const solverTokenAmounts: Record<string, bigint> = {} // ATA, balance
    const preTokenAmounts = await Promise.all(
      solverAtas.map(async (ata) => {
        const balance = await this.connection.getTokenAccountBalance(ata)
        solverTokenAmounts[ata.toString()] = BigInt(balance.value.amount)
        return BigInt(balance.value.amount)
      }),
    )

    const blockhashData = await this.connection.getLatestBlockhash()
    const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150_000 })
    const fulfillMessage = new TransactionMessage({
      payerKey: solverKey,
      recentBlockhash: blockhashData.blockhash,
      instructions: [computeUnitPriceIx, ...fulfillInstructions],
    }).compileToV0Message()
    const fulfillTransaction = new VersionedTransaction(fulfillMessage)

    const simulationResult = await this.connection.simulateTransaction(fulfillTransaction, {
      sigVerify: false,
      replaceRecentBlockhash: false,
      commitment: 'confirmed',
      accounts: accountsConfig,
    })

    if (simulationResult.value.err) {
      throw new Error(`Simulation failed: ${JSON.stringify(simulationResult.value.err)}`)
    }

    const unitsConsumed = simulationResult.value.unitsConsumed ?? 0
    const lamportsFee = unitsConsumed * 1_000 // microLamports -> lamports

    const postSimulationAccounts = simulationResult.value.accounts
    if (!postSimulationAccounts || postSimulationAccounts.length === 0) {
      throw new Error(`Simulation failed: no accounts returned`)
    }

    // index 0 is solver's system account
    const postSolverLamports = postSimulationAccounts[0]?.lamports
    if (!postSolverLamports) {
      throw new Error(`Simulation failed: couldn't get solver account lamports`)
    }

    // Calculate SOL outflow
    // SOL outflow = preLamports - postLamports + lamportsFee
    const lamportsOutflow =
      BigInt(solverAccountInfo.lamports) - BigInt(postSolverLamports) + BigInt(lamportsFee)

    // Calculate token outflows
    const postTokenAmounts = postSimulationAccounts.slice(1).map((acc) => {
      if (!acc || acc.data.length === 0) {
        return 0n
      }

      return this.decodeAmount(acc.data[0])
    })

    const tokenOut: Record<string, bigint> = {}
    for (let i = 0; i < routeMints.length; i++) {
      const tokenBalanceDelta = preTokenAmounts[i] - postTokenAmounts[i]
      if (tokenBalanceDelta > 0n) {
        tokenOut[routeMints[i].toBase58()] = tokenBalanceDelta
      }
    }

    // Assert outflows equal route amounts
    for (const tokenAmount of intent.route.tokens) {
      const mint = bs58.encode(this.fulfillBuilder.hex32ToBuf(tokenAmount.token))
      const expected = tokenAmount.amount
      const tokenOutflow = tokenOut[mint] ?? 0n

      if (tokenOutflow !== expected) {
        throw new Error(`Route token ${mint} outflow ${tokenOutflow} != expected ${expected}`)
      }
    }

    this.logger.debug(
      `SVM intent ${intent.hash} simulation result: lamportsOutflow=${lamportsOutflow} tokens=${JSON.stringify(
        tokenOut,
      )}`,
    )

    return {
      solverLamports: BigInt(solverAccountInfo.lamports),
      solverTokenAmounts,
      lamportsOut: lamportsOutflow,
      tokenOut,
    }
  }

  /**
   * Given a simulated transaction account info, decode the amount
   * of the SPL token at offset 64..72.
   */
  decodeAmount(info: string): bigint {
    // base64 layout of SPL‐token account: first 64 bytes irrelevant (mint & owner pubkeys),
    // amount u64 at offset 64..72 little-endian
    const data = Buffer.from(info, 'base64')
    return data.readBigUInt64LE(64)
  }
}
