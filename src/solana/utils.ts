import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { decodeIntentAccountRaw } from '@/indexer/services/solana-intent-decoder'
import { Logger } from '@nestjs/common'
import { MintLayout } from '@solana/spl-token'
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
