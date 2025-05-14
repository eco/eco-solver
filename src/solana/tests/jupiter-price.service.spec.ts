import { Test, TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'
import { JupiterPriceService } from '@/solana/price/jupiter-price.service'

const realFetch = global.fetch

describe('JupiterPriceService', () => {
  let priceService: JupiterPriceService
  let cache: Cache

  const FAKE_MINT = 'So11111111111111111111111111111111111111112' // wrapped SOL
  const FAKE_PRICE = 173.45

  const USDC_MINT = 'EPjFWdd5AufqSSqeM2q5u84jFjZCrt7xvxywcu3aM3P'
  const USDC_PRICE = 0.999

  const buildFakeResponse = (mint: string, price: number) => ({
    data: {
      [mint]: {
        id: mint,
        type: 'derivedPrice',
        price: price.toString(),
      },
    },
    timeTaken: 6,
  })

  beforeAll(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => buildFakeResponse(FAKE_MINT, FAKE_PRICE),
    }) as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JupiterPriceService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile()

    priceService = module.get(JupiterPriceService)
    cache = module.get(CACHE_MANAGER)
  })

  afterEach(() => jest.clearAllMocks())

  it('fetches price and caches the result', async () => {
    const price1 = await priceService.getPriceUsd(FAKE_MINT)
    expect(price1).toBe(FAKE_PRICE)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`ids=${FAKE_MINT}`))

    expect(cache.set).toHaveBeenCalledWith(`jup-price:${FAKE_MINT}`, FAKE_PRICE, expect.any(Number))

    // next call should come from cache — prepare mock
    ;(cache.get as jest.Mock).mockResolvedValueOnce(FAKE_PRICE)

    const price2 = await priceService.getPriceUsd(FAKE_MINT)
    expect(price2).toBe(FAKE_PRICE)

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns price for USDC mint', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => buildFakeResponse(USDC_MINT, USDC_PRICE),
    })

    const price = await priceService.getPriceUsd(USDC_MINT)
    expect(price).toBe(USDC_PRICE)

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`ids=${USDC_MINT}`))
  })
})

describe('JupiterPriceService (integration)', () => {
  let priceService: JupiterPriceService
  let cache: Cache

  const USDC_MINT = 'EPjFWdd5AufqSSqeM2q5u84jFjZCrt7xvxywcu3aM3P'

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JupiterPriceService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile()

    priceService = module.get(JupiterPriceService)
    cache = module.get(CACHE_MANAGER)
  })

  jest.setTimeout(15_000)

  it('fetches a real price for USDC from Jupiter', async () => {
    const price = await priceService.getPriceUsd(USDC_MINT)

    expect(typeof price).toBe('number')
    expect(price).toBeGreaterThan(0)
    expect(Math.abs(price! - 1)).toBeLessThan(0.1)

    expect(cache.set).toHaveBeenCalledWith(`jup-price:${USDC_MINT}`, price, expect.any(Number))
  })
})

afterAll(() => {
  global.fetch = realFetch
})
