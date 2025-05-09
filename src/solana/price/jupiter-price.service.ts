import { Injectable, Logger } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'

export interface JupiterPriceEntry {
  id: string
  type: 'derivedPrice'
  price: string
}

export interface JupiterPriceResponse {
  data: Record<string, JupiterPriceEntry>
  timeTaken: number
}

/**
 *  Lightweight service that retrieves (and caches) USD prices for SPL tokens
 *  from Jupiter's /price/v2 endpoint
 */
@Injectable()
export class JupiterPriceService {
  private readonly logger = new Logger(JupiterPriceService.name)
  private readonly BASE_PRICE_API_URL = 'https://lite-api.jup.ag/price/v2'

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Returns a mapping "mint -> priceUsd" for all "mints"
   * Result is cached for "ttlSec" seconds
   */
  async getPricesUsd(mints: string[], ttlSec = 30): Promise<Record<string, number>> {
    const unique = [...new Set(mints)]
    const cached: Record<string, number> = {}
    const missing: string[] = []

    for (const mint of unique) {
      const mintPrice = await this.cache.get<number>(`jup-price:${mint}`)
      if (mintPrice) {
        cached[mint] = mintPrice
        continue
      } else missing.push(mint)
    }

    if (missing.length === 0) {
      return cached
    }

    try {
      const url = `${this.BASE_PRICE_API_URL}?ids=${missing.join(',')}`
      const priceResult = await fetch(url)
      if (!priceResult.ok) {
        throw new Error(
          `Error fetching SPL price: HTTP ${priceResult.status}; ${priceResult.statusText}`,
        )
      }

      const jupiterPriceResponse = (await priceResult.json()) as JupiterPriceResponse
      Object.entries(jupiterPriceResponse.data).forEach(([mint, entry]) => {
        const price = Number(entry.price)

        if (!Number.isFinite(price)) {
          return
        }

        cached[mint] = price
        this.cache.set(`jup-price:${mint}`, price, ttlSec * 1000).catch(() => {})
      })

      return cached
    } catch (err) {
      this.logger.error(`Jupiter price fetch failed`, err as any)
      return cached
    }
  }

  async getPriceUsd(mint: string): Promise<number | undefined> {
    return (await this.getPricesUsd([mint]))[mint]
  }
}
