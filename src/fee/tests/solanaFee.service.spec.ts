import { Test, TestingModule } from '@nestjs/testing'
import { SolanaFeeService, SOL_TOKEN_ADDRESS } from '@/fee/solanaFee.service'
import { JupiterPriceService } from '@/solana/price/jupiter-price.service'
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58 from 'bs58'

jest.mock('@/solana/utils', () => ({
  fetchDecimals: jest.fn(),
}))

import { fetchDecimals } from '@/solana/utils'

describe('SolanaFeeService', () => {
  let service: SolanaFeeService
  let priceSrv: jest.Mocked<JupiterPriceService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaFeeService,
        {
          provide: JupiterPriceService,
          useValue: {
            getPriceUsd: jest.fn(),
            getPricesUsd: jest.fn(),
          },
        },
        {
          provide: Connection,
          useValue: {},
        },
      ],
    }).compile()

    service = module.get<SolanaFeeService>(SolanaFeeService)
    priceSrv = module.get(JupiterPriceService)
  })

  const mintA = bs58.encode(Buffer.from('aa'.repeat(32), 'hex'))
  const mintB = bs58.encode(Buffer.from('bb'.repeat(32), 'hex'))
  const hex = (buf: Buffer) => '0x' + buf.toString('hex')

  it('calculates USD for SOL-only rewards', async () => {
    const solPrice = 180 // $180
    ;(priceSrv.getPriceUsd as jest.Mock).mockResolvedValue(solPrice)

    const lamports = BigInt(2 * LAMPORTS_PER_SOL) // 2 SOL
    const input = { nativeValue: lamports, tokens: [] }

    const result = await service.calculateRewardUsdFromAny(input)

    expect('error' in result).toBe(false)
    if ('totalUsd' in result) {
      expect(result.totalUsd).toBeCloseTo(2 * solPrice)
      expect(result.breakdown.SOL).toBeCloseTo(2 * solPrice)
    }
    expect(priceSrv.getPriceUsd).toHaveBeenCalledWith(SOL_TOKEN_ADDRESS)
    expect(priceSrv.getPricesUsd).not.toHaveBeenCalled()
  })

  it('calculates USD for SPL token-only rewards', async () => {
    const priceMap = { [mintA]: 0.5, [mintB]: 2 }
    ;(priceSrv.getPricesUsd as jest.Mock)
      .mockResolvedValue(priceMap)(fetchDecimals as jest.Mock)
      .mockResolvedValue({ [mintA]: 6, [mintB]: 9 })

    const input = {
      nativeValue: 0n,
      tokens: [
        { token: hex(Buffer.from('aa'.repeat(32), 'hex')), amount: '1000000' }, // 1 tokenA
        { token: hex(Buffer.from('bb'.repeat(32), 'hex')), amount: '2000000000' }, // 2 tokenB
      ],
    }

    const result = await service.calculateRewardUsdFromAny(input)

    expect('error' in result).toBe(false)
    if ('totalUsd' in result) {
      expect(result.breakdown[mintA]).toBeCloseTo(1 * 0.5)
      expect(result.breakdown[mintB]).toBeCloseTo(2 * 2)
      expect(result.totalUsd).toBeCloseTo(0.5 + 4)
    }
    expect(priceSrv.getPricesUsd).toHaveBeenCalledWith([mintA, mintB])
  })

  it('calculates USD for mixed SOL + tokens', async () => {
    // 1 SOL + 3 tokenA (6-dec) -> $180/SOL, $1/token
    ;(priceSrv.getPriceUsd as jest.Mock)
      .mockResolvedValue(180)(priceSrv.getPricesUsd as jest.Mock)
      .mockResolvedValue({ [mintA]: 1 })(fetchDecimals as jest.Mock)
      .mockResolvedValue({ [mintA]: 6 })

    const input = {
      nativeValue: BigInt(1 * LAMPORTS_PER_SOL), // 1 SOL
      tokens: [{ token: hex(Buffer.from('aa'.repeat(32), 'hex')), amount: '3000000' }], // 3 tokenA
    }

    const res = await service.calculateRewardUsdFromAny(input)
    expect('error' in res).toBe(false)
    if ('totalUsd' in res) {
      expect(res.totalUsd).toBeCloseTo(180 + 3) // $183
    }
  })

  it('skips tokens with missing price or decimals (warn but continue)', async () => {
    ;(priceSrv.getPriceUsd as jest.Mock)
      .mockResolvedValue(0)(
        // no SOL
        priceSrv.getPricesUsd as jest.Mock,
      )
      .mockResolvedValue({})(
        // price missing
        fetchDecimals as jest.Mock,
      )
      .mockResolvedValue({}) // decimals missing

    const input = {
      nativeValue: 0n,
      tokens: [{ token: hex(Buffer.from('aa'.repeat(32), 'hex')), amount: '1000' }],
    }

    const result = await service.calculateRewardUsdFromAny(input)
    expect('error' in result).toBe(false)
    if ('totalUsd' in result) {
      expect(result.totalUsd).toBe(0)
      expect(Object.keys(result.breakdown)).toHaveLength(0)
    }
  })

  it('returns "error" wrapper when an exception is thrown', async () => {
    // Force fetchDecimals to throw
    ;(fetchDecimals as jest.Mock).mockImplementation(() => {
      throw new Error('boom')
    })

    const input = { nativeValue: 0n, tokens: [] }
    const result = await service.calculateRewardUsdFromAny(input)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('boom')
    }
  })
})
