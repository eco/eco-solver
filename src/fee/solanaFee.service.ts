import { Injectable, Logger } from '@nestjs/common'
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { JupiterPriceService } from '@/solana/price/jupiter-price.service'
import bs58 from 'bs58'
import { fetchDecimals } from '@/solana/utils'

export const SOL_TOKEN_ADDRESS: string = 'So11111111111111111111111111111111111111112'
export const USDC_DECIMALS: number = 6

/**
 * Given a raw SVM intent (IntentRaw) it outputs the USD value of:
 *   - native SOL reward  (native_amount)
 *   - SPL reward tokens  (reward.tokens[])
 */
@Injectable()
export class SolanaFeeService {
  private readonly logger = new Logger(SolanaFeeService.name)

  constructor(
    private readonly price: JupiterPriceService,
    private readonly connection: Connection,
  ) {}

  /**
   * Returns "{ totalUsd, breakdown }"
   *
   * "breakdown" keeps individual token-wise USD numbers
   */
  async calculateRewardUsdFromAny(input: {
    nativeValue: bigint
    tokens: { token: string; amount: string }[]
  }): Promise<{ totalUsd: number; breakdown: Record<string, number> } | { error: Error }> {
    const breakdown: Record<string, number> = {}

    try {
      if (input.nativeValue > 0n) {
        const solPrice = (await this.price.getPriceUsd(SOL_TOKEN_ADDRESS)) ?? 0
        const solAmount = Number(input.nativeValue) / LAMPORTS_PER_SOL
        breakdown['SOL'] = solAmount * solPrice
      }

      if (input.tokens.length) {
        const mints = input.tokens.map((tokenAmount) =>
          bs58.encode(Buffer.from(tokenAmount.token.replace(/^0x/, ''), 'hex')),
        )
        const prices = await this.price.getPricesUsd(mints)
        const decimalsMap = await fetchDecimals(mints, this.connection)

        input.tokens.forEach((tokenAmount) => {
          const mint = bs58.encode(Buffer.from(tokenAmount.token.replace(/^0x/, ''), 'hex'))

          const decimals = decimalsMap[mint]
          if (!decimals) {
            this.logger.warn(`Couldn't get decimals for mint ${mint}`)
            return
          }

          const tokenPrice = prices[mint]
          if (!tokenPrice) {
            this.logger.warn(`No price for mint ${mint} found`)
            return
          }

          const uiAmount = Number(tokenAmount.amount) / 10 ** decimals
          breakdown[mint] = uiAmount * tokenPrice
        })
      }

      const totalUsd = Object.values(breakdown).reduce((a, b) => a + b, 0)
      return { totalUsd, breakdown }
    } catch (error) {
      return { error }
    }
  }
}
