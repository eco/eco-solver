import {
  Connection,
  Keypair,
  ParsedTransactionWithMeta,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { TransactionReceipt } from 'viem'
import { UtilsIntentService } from './utils-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { IntentDataModel } from './schemas/intent-data.schema'
import bs58 from 'bs58'
import { Program } from '@coral-xyz/anchor'
import { EcoRoutes } from '@/solana/program/eco_routes'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { SerializableAccountMeta, SvmCallDataWithMetas } from '@/solana/serialization/svm-call-data'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { SimulationResult } from '@/solana/solana-cost.service'
import {
  assertAccountInfo,
  assertTokenAccount,
  createLighthouseProgram,
  IntegerOperator,
} from 'lighthouse-sdk-legacy'
import { fromWeb3JsPublicKey, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters'
import { sendTransactionWithRetry } from '@/solana/utils'

const MAILBOX_PROGRAM_ID: PublicKey = new PublicKey('E588QtVUvresuXq2KoNEwAmoifCzYGpRBdHByN9KQMbi')
const SPL_NOOP_PROGRAM_ID: PublicKey = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV')
const SOLVER_PLACEHOLDER_PUBKEY: PublicKey = new PublicKey(
  'So1ver1111111111111111111111111111111111111',
)

export type FulfillArgs = {
  intentHash: string
  simulationResult: SimulationResult
}

@Injectable()
export class SolanaFulfillService {
  private readonly logger = new Logger(SolanaFulfillService.name)
  private readonly program: Program<EcoRoutes>

  constructor(
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
    @Inject('SOLVER_SOLANA_KEYPAIR') private readonly solver: Keypair,
  ) {}

  async fulfill({ intentHash, simulationResult }: FulfillArgs): Promise<string> {
    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, err } = data ?? {}
    if (!model || err) throw err

    const connection = new Connection(this.ecoConfigService.getSolanaConfig().rpc_url, 'confirmed')

    const fulfillIxs = await this.buildFulfillIntentIxs(
      model.intent,
      this.solver.publicKey,
      connection,
      simulationResult,
    )
    const blockhash = await connection.getLatestBlockhash()

    const fulfillTx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: this.solver.publicKey,
        recentBlockhash: blockhash.blockhash,
        instructions: fulfillIxs,
      }).compileToV0Message(),
    )
    fulfillTx.sign([this.solver])

    const blockHeight = await connection.getBlockHeight()
    const signature = await sendTransactionWithRetry(connection, fulfillTx, blockHeight)
    if (!signature) {
      throw new Error('Failed to send a fulfill transaction')
    }

    await connection.confirmTransaction(
      {
        signature,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
      },
      'confirmed',
    )

    this.logger.debug(`Fulfilled intent ${intentHash} with transaction: ${signature.toString()}`)

    const fulfilTxData = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    if (!fulfilTxData) {
      throw new Error(`Transaction ${signature} not found`)
    }

    const receipt = this.convertSolanaTxToEvmReceipt(
      fulfilTxData,
      signature,
      fulfilTxData.transaction.message.recentBlockhash,
    )
    if (!receipt) {
      throw new Error('Failed to convert Solana transaction to EVM receipt')
    }

    model.status = 'SOLVED'
    model.receipt = receipt
    await this.utilsIntentService.updateIntentModel(model)

    return signature
  }

  async buildFulfillIntentIxs(
    intent: IntentDataModel,
    solverPubkey: PublicKey,
    connection: Connection,
    simulationResult?: SimulationResult,
  ): Promise<TransactionInstruction[]> {
    const routerProgramId = this.program.programId
    const fulfillInstructions: TransactionInstruction[] = []

    const intentHashBuffer = this.hex32ToBuf(intent.hash)
    const saltBuffer = this.hex32ToBuf(intent.route.salt)
    const inboxBuffer = this.hex32ToBuf(intent.route.inbox)
    const salt = Buffer.from(intent.route.salt.replace(/^0x/, ''), 'hex')
    if (salt.length !== 32) {
      throw new Error(`Invalid salt length: expected 32 bytes, got ${salt.length}`)
    }

    const executionAuthority = PublicKey.findProgramAddressSync(
      [Buffer.from('execution_authority'), salt],
      routerProgramId,
    )[0]

    const dispatchAuthority = PublicKey.findProgramAddressSync(
      [Buffer.from('dispatch_authority')],
      routerProgramId,
    )[0]

    const outboxPda = PublicKey.findProgramAddressSync(
      [Buffer.from('hyperlane'), Buffer.from('-'), Buffer.from('outbox')],
      MAILBOX_PROGRAM_ID,
    )[0]

    const uniqueMessage = Keypair.generate()

    const dispatchedMessagePda = PublicKey.findProgramAddressSync(
      [
        Buffer.from('hyperlane'),
        Buffer.from('-'),
        Buffer.from('dispatched_message'),
        Buffer.from('-'),
        uniqueMessage.publicKey.toBuffer(),
      ],
      MAILBOX_PROGRAM_ID,
    )[0]

    const intentFulfillmentMarker = PublicKey.findProgramAddressSync(
      [Buffer.from('intent_fulfillment_marker'), intentHashBuffer],
      routerProgramId,
    )[0]

    for (const token of intent.route.tokens) {
      const mintPubkey = new PublicKey(this.hex32ToBuf(token.token))
      const ata = getAssociatedTokenAddressSync(mintPubkey, solverPubkey)
      const ataExists = await connection.getAccountInfo(ata)
      if (!ataExists) {
        fulfillInstructions.push(
          createAssociatedTokenAccountIdempotentInstruction(
            solverPubkey,
            getAssociatedTokenAddressSync(mintPubkey, executionAuthority, true),
            executionAuthority,
            mintPubkey,
          ),
        )
      }
    }

    // convert Route and Reward to IDL format

    // Strip acc-metas in calls (route_without_metas)
    const callsIDL = intent.route.calls.map((call) => {
      const calldataRaw = this.hex32ToBuf(call.data)
      const calldataWithMetas = SvmCallDataWithMetas.deserialize(calldataRaw)
      const calldataWithoutMetas = calldataWithMetas.svm_call_data

      return {
        destination: this.hex32ToBuf(call.target),
        calldata: calldataWithoutMetas.toBytes(),
        _accountMetas: calldataWithMetas.account_metas, // keep for later
      }
    })

    const routeTokensIDL = intent.route.tokens.map((token) => ({
      token: this.hex32ToBuf(token.token),
      amount: this.toU64(token.amount),
    }))

    const rewardTokensIDL = intent.reward.tokens.map((token) => ({
      token: this.hex32ToBuf(token.token),
      amount: this.toU64(token.amount),
    }))

    const routeIDL = {
      salt: saltBuffer,
      sourceDomainId: Number(intent.route.source),
      destinationDomainId: Number(intent.route.destination),
      inbox: inboxBuffer,
      tokens: routeTokensIDL,
      calls: callsIDL.map(({ destination, calldata }) => ({ destination, calldata })),
    }

    const rewardIDL = {
      creator: new PublicKey(this.hex32ToBuf(intent.reward.creator)),
      tokens: rewardTokensIDL,
      prover: this.hex32ToBuf(intent.reward.prover),
      nativeAmount: this.toU64(intent.reward.nativeValue),
      deadline: this.toI64(intent.reward.deadline),
    }

    const args = {
      intentHash: intentHashBuffer,
      route: routeIDL,
      reward: rewardIDL,
    }

    const fulfillIx = await this.program.methods
      .fulfillIntent(args)
      .accountsStrict({
        payer: solverPubkey,
        solver: solverPubkey,
        executionAuthority,
        dispatchAuthority,
        mailboxProgram: MAILBOX_PROGRAM_ID,
        outboxPda,
        splNoopProgram: SPL_NOOP_PROGRAM_ID,
        uniqueMessage: uniqueMessage.publicKey,
        intentFulfillmentMarker,
        dispatchedMessagePda,
        splTokenProgram: TOKEN_PROGRAM_ID,
        splToken2022Program: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(
        intent.route.tokens
          .flatMap(({ token }) => {
            const mintPubkey = new PublicKey(this.hex32ToBuf(token))
            const sourceAta = getAssociatedTokenAddressSync(mintPubkey, solverPubkey)
            const destinationAta = getAssociatedTokenAddressSync(
              mintPubkey,
              executionAuthority,
              true,
            )
            return [
              { pubkey: mintPubkey, isSigner: false, isWritable: false },
              { pubkey: sourceAta, isSigner: false, isWritable: true },
              { pubkey: destinationAta, isSigner: false, isWritable: true },
            ]
          })
          .concat(
            callsIDL.flatMap(({ _accountMetas }) =>
              _accountMetas.map((meta: SerializableAccountMeta) => {
                const pubkey = new PublicKey(meta.pubkey)
                return {
                  pubkey: pubkey.equals(SOLVER_PLACEHOLDER_PUBKEY) ? solverPubkey : pubkey,
                  isSigner: pubkey.equals(executionAuthority) ? false : meta.is_signer === 1,
                  isWritable: pubkey.equals(executionAuthority) ? true : meta.is_writable === 1,
                }
              }),
            ),
          ),
      )
      .instruction()
    fulfillInstructions.push(fulfillIx)

    if (simulationResult) {
      const umi = createUmi(connection.rpcEndpoint)
      umi.programs.add(createLighthouseProgram())

      // Solver lamports assertion instruction
      const minLamportsThreshold = simulationResult.solverLamports - simulationResult.lamportsOut
      const lamportsAssertIx = toWeb3JsInstruction(
        assertAccountInfo(umi, {
          targetAccount: fromWeb3JsPublicKey(solverPubkey),
          assertion: {
            __kind: 'Lamports',
            value: Number(minLamportsThreshold),
            operator: IntegerOperator.GreaterThanOrEqual,
          },
        }).getInstructions()[0],
      )
      fulfillInstructions.push(lamportsAssertIx)

      // Solver token amounts assertion instructions
      intent.route.tokens.map((token) => {
        const mint = new PublicKey(this.hex32ToBuf(token.token))
        const solverAta = getAssociatedTokenAddressSync(mint, solverPubkey)
        const minTokensThreshold =
          (simulationResult.solverTokenAmounts[solverAta.toString()] ?? 0n) -
          (simulationResult.tokenOut[mint.toBase58()] ?? 0n)

        fulfillInstructions.push(
          toWeb3JsInstruction(
            assertTokenAccount(umi, {
              targetAccount: fromWeb3JsPublicKey(solverAta),
              assertion: {
                __kind: 'Amount',
                value: Number(minTokensThreshold),
                operator: IntegerOperator.GreaterThanOrEqual,
              },
            }).getInstructions()[0],
          ),
        )
      })
    }

    return fulfillInstructions
  }

  convertSolanaTxToEvmReceipt(
    tx: ParsedTransactionWithMeta,
    txSignature: string,
    blockHash: string,
  ): TransactionReceipt | null {
    const meta = tx.meta
    const info = tx.transaction.message
    const sender = info.accountKeys[0].pubkey.toBase58()

    for (const ix of info.instructions) {
      if (ix.programId.toBase58() === this.ecoConfigService.getSolanaConfig().router_program_id) {
        return {
          blockHash: `0x${blockHash}`,
          blockNumber: BigInt(tx.slot),
          contractAddress: null,
          cumulativeGasUsed: BigInt(0),
          effectiveGasPrice: BigInt(0),
          from: `0x${this.toHex(sender)}`,
          gasUsed: BigInt(meta?.fee || 0),
          logs: [],
          logsBloom: `0x00`,
          status: meta?.err ? 'reverted' : 'success',
          to: null,
          transactionHash: `0x${this.toHex(txSignature)}`,
          transactionIndex: 0,
          type: 'solana',
        }
      }
    }
    return null
  }

  toHex(base58: string): string {
    return Buffer.from(bs58.decode(base58)).toString('hex')
  }

  // turn a `0x…` 32-byte string into Buffer(32)
  public hex32ToBuf = (hex: string) => Buffer.from(hex.replace(/^0x/, ''), 'hex')

  // convert bigint|string u64 -> bigint for Anchor BN
  toU64 = (v: string | bigint) => BigInt(v)

  // convert bigint|string i64 -> bigint for Anchor BN
  toI64 = (v: string | bigint) => BigInt(v)
}
