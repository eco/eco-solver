import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { decodeIntentAccountRaw } from '@/indexer/services/solana-intent-decoder'
import { Logger } from '@nestjs/common'
import { MintLayout } from '@solana/spl-token'
import { VersionedTransaction } from '@solana/web3.js'
import { Connection, PublicKey } from '@solana/web3.js'
import { Hex } from 'viem'

export async function fetchDecimals(
  mints: string[],
  connection: Connection,
): Promise<Record<string, number>> {
  const decimalsRecord: Record<string, number> = {}

  const pubkeys = mints.map((mint) => new PublicKey(mint))
  const infos = await connection.getMultipleAccountsInfo(pubkeys, 'confirmed')

  infos.forEach((acc, idx) => {
    if (!acc?.data) {
      this.logger.warn(`Couldn't get account data for mint ${mints[idx]}`)
      return
    }

    try {
      const mintData = MintLayout.decode(acc.data)
      decimalsRecord[mints[idx]] = mintData.decimals
    } catch (error) {
      this.logger.warn(`Couldn't decode mint data for mint ${mints[idx]}: `, error)
    }
  })

  return decimalsRecord
}

export async function fetchRawSvmIntentAccount(
  intentHash: Hex,
  connection: Connection,
  logger: Logger,
  routerProgram: PublicKey,
) {
  try {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('intent'), Buffer.from(intentHash.slice(2), 'hex')],
      routerProgram,
    )

    const acc = await connection.getAccountInfo(pda, 'confirmed')
    if (!acc) {
      logger.error(`PDA for intent ${intentHash} not found`)
      return
    }

    return decodeIntentAccountRaw(Buffer.from(acc.data))
  } catch (err) {
    logger.error(
      EcoLogMessage.fromDefault({
        message: `Failed to fetch SVM Intent PDA`,
        properties: { intentHash, err },
      }),
    )
    return
  }
}

export function sendTransactionWithRetry(
  connection: Connection,
  signedTransaction: VersionedTransaction,
  blockHeight: number,
  maxRetries: number = 5,
): Promise<string | undefined> {
  return new Promise(async (resolve, reject) => {
    let txHash: string | undefined
    let currentBlockHeight = await connection.getBlockHeight()

    while (currentBlockHeight < blockHeight) {
      try {
        if (!txHash) {
          txHash = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: true,
            preflightCommitment: 'confirmed',
            maxRetries: 0,
          })
        } else {
          await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: true,
            preflightCommitment: 'confirmed',
            maxRetries: 0,
          })
        }
      } catch (error) {
        await sleep(1000)
      }

      if (txHash) {
        const txCommitment = await connection.getSignatureStatus(txHash)
        if (
          txCommitment.value?.confirmationStatus === 'confirmed' ||
          txCommitment.value?.confirmationStatus === 'finalized'
        ) {
          break
        }
      }

      await sleep(1000)
      currentBlockHeight = await connection.getBlockHeight('confirmed')
    }

    if (txHash && signedTransaction.message.recentBlockhash) {
      try {
        await connection.confirmTransaction(
          {
            blockhash: signedTransaction.message.recentBlockhash,
            lastValidBlockHeight: blockHeight,
            signature: txHash,
          },
          'confirmed',
        )
      } catch (error) {
        reject({ message: 'Error confirming transaction: ' + error, txHash })
      }

      let retries = maxRetries
      while (retries > 0) {
        const txInfo = await connection.getTransaction(txHash, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        })

        if (txInfo) {
          const error = txInfo?.meta?.err
          if (error) {
            reject({ message: `Tx (${txHash}) error: ${error}`, txHash })
            break
          }
          resolve(txHash)
          break
        } else {
          await sleep(1000)
          retries--
        }
      }

      if (retries === 0) {
        reject({ message: 'Failed to retrieve transaction info', txHash })
      }
    } else {
      reject({ message: 'Failed to send transaction', txHash })
    }
  })
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))
