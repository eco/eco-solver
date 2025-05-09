import { Injectable, Logger } from '@nestjs/common'
import {
  Connection,
  PublicKey,
  ComputeBudgetProgram,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
  AccountMeta,
} from '@solana/web3.js'
import { Hex } from 'viem'
import bs58 from 'bs58'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { SvmCallData } from './serialization/svm-call-data'

export interface SimulationResult {
  // lamports consumed by the tx (compute‑unit fee + signature fee)
  lamports: number
  // token amounts
  tokens: Record<string, bigint>
}

@Injectable()
export class SolanaCostService {
  private readonly logger = new Logger(SolanaCostService.name)

  constructor(private readonly connection: Connection) {}

  /**
   * Builds a dummy tx that mirrors the Route.calls array and simulates it
   * via `connection.simulateTransaction`.
   *
   * Returns lamport cost + token delta map. Throws if simulation errors.
   */
  async simulateIntent(intent: IntentDataModel, solverKey: PublicKey): Promise<SimulationResult> {
    this.logger.debug(`Simulating SVM intent ${intent} with ${intent.route.calls.length} calls`)

    const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    let lamports = 0

    for (const call of intent.route.calls) {
      const blockhashData = await this.connection.getLatestBlockhash()

      const rawCalldata = Buffer.from(call.data.replace(/^0x/, ''), 'hex')
      const { instruction_data, account_metas } = SvmCallData.deserialize(rawCalldata)
      const keys: AccountMeta[] = account_metas.map((meta) => ({
        pubkey: new PublicKey(meta.pubkey),
        isSigner: meta.is_signer === 1,
        isWritable: meta.is_writable === 1,
      }))

      const instructions: TransactionInstruction[] = [
        computeUnitPriceIx,
        new TransactionInstruction({
          programId: new PublicKey(Buffer.from(call.target.replace(/^0x/, ''), 'hex')),
          keys,
          data: Buffer.from(instruction_data),
        }),
      ]

      const messageV0 = new TransactionMessage({
        payerKey: solverKey,
        recentBlockhash: blockhashData.blockhash,
        instructions,
      }).compileToV0Message()

      const intentTransaction = new VersionedTransaction(messageV0)

      const { value } = await this.connection.simulateTransaction(intentTransaction, {
        commitment: 'confirmed',
        sigVerify: false,
        replaceRecentBlockhash: true,
      })

      if (value.err) {
        throw new Error(`SVM Intent simulation failed: ${JSON.stringify(value.err)}`)
      }

      lamports = (value.unitsConsumed ?? 0) * 1000 // microLamports -> lamports
    }

    const tokenSpend: Record<Hex, bigint> = {}
    for (const tokenAmount of intent.route.tokens) {
      const tokenAddress = bs58.encode(Buffer.from(tokenAmount.token.replace(/^0x/, ''), 'hex'))
      tokenSpend[tokenAddress] = (tokenSpend[tokenAddress] ?? 0n) - BigInt(tokenAmount.amount)
    }

    this.logger.debug(
      `SVM intent ${intent.hash} simulation result: ${lamports} lamports, tokens: ${JSON.stringify(
        tokenSpend,
      )}`,
    )

    return { lamports, tokens: tokenSpend }
  }
}
