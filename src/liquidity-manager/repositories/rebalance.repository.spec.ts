import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { createMock } from '@golevelup/ts-jest'
import { Model } from 'mongoose'

import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'

describe('RebalanceRepository.getPendingReservedByTokenForWallet', () => {
  let repo: RebalanceRepository
  let model: jest.Mocked<Model<RebalanceModel>>

  function mockFindReturn(docs: any[]) {
    ;(model.find as unknown as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(docs),
    } as any)
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebalanceRepository,
        { provide: getModelToken(RebalanceModel.name), useValue: createMock<Model<RebalanceModel>>() },
      ],
    }).compile()

    repo = module.get(RebalanceRepository)
    model = module.get(getModelToken(RebalanceModel.name)) as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('aggregates duplicates for same (chain,address) and normalizes address case', async () => {
    const wallet = '0xabc'
    const addrMixed = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
    const addrLower = addrMixed.toLowerCase()

    mockFindReturn([
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: addrMixed }, amountIn: 120_000_000n },
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: addrLower }, amountIn: 30_000_000n },
    ])

    const map = await repo.getPendingReservedByTokenForWallet(wallet)
    const key = `10:${addrLower}`
    expect(map.get(key)).toEqual(150_000_000n)
  })

  it('ignores non-positive amountIn (zero/negative)', async () => {
    const wallet = '0xabc'
    mockFindReturn([
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: '0xdead' }, amountIn: 0n },
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: '0xdead' }, amountIn: -5n },
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: '0xdead' }, amountIn: 10n },
    ])

    const map = await repo.getPendingReservedByTokenForWallet(wallet)
    expect(map.get('10:0xdead')).toEqual(10n)
  })

  it('tokenIn-only aggregation: tokenOut fields are ignored', async () => {
    const wallet = '0xabc'
    mockFindReturn([
      {
        status: 'PENDING',
        wallet,
        tokenIn: { chainId: 10, tokenAddress: '0xaaa' },
        tokenOut: { chainId: 10, tokenAddress: '0xbbb' },
        amountIn: 7n,
      },
    ])

    const map = await repo.getPendingReservedByTokenForWallet(wallet)
    expect(map.get('10:0xaaa')).toEqual(7n)
    expect(map.get('10:0xbbb')).toBeUndefined()
  })

  it('queries with wallet and PENDING status only', async () => {
    const wallet = '0xwallet'
    mockFindReturn([])

    await repo.getPendingReservedByTokenForWallet(wallet)

    expect(model.find).toHaveBeenCalledWith(
      { status: 'PENDING', wallet },
      expect.objectContaining({ amountIn: 1, tokenIn: 1, wallet: 1, status: 1 }),
    )
  })

  it.skip('skips invalid docs (missing fields) but processes valid ones', async () => {
    const wallet = '0xabc'
    mockFindReturn([
      { status: 'PENDING', wallet, tokenIn: { chainId: 10 }, amountIn: 10n }, // missing tokenAddress → skip
      { status: 'PENDING', wallet, tokenIn: { tokenAddress: '0xdead' }, amountIn: 10n }, // missing chainId → skip
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: '0xdead' }, amountIn: 25n },
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: '0xdead' }, amountIn: undefined }, // missing amountIn → skip
    ])

    const map = await repo.getPendingReservedByTokenForWallet(wallet)
    expect(map.size).toBe(1)
    expect(map.get(`10:${'0xdead'}`)).toEqual(25n)
  })

  it('handles very large bigint amounts safely', async () => {
    const wallet = '0xabc'
    const big = 123456789012345678901234567890n
    mockFindReturn([
      { status: 'PENDING', wallet, tokenIn: { chainId: 1, tokenAddress: '0xusdc' }, amountIn: big },
    ])

    const map = await repo.getPendingReservedByTokenForWallet(wallet)
    expect(map.get(`1:${'0xusdc'}`)).toEqual(big)
  })

  it('returns empty map when no matches', async () => {
    const wallet = '0xabc'
    mockFindReturn([])

    const map = await repo.getPendingReservedByTokenForWallet(wallet)
    expect(map.size).toBe(0)
  })

  it('returns multiple keys for multiple tokens with independent sums', async () => {
    const wallet = '0xabc'
    mockFindReturn([
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: '0xaaa' }, amountIn: 10n },
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: '0xbbb' }, amountIn: 20n },
      { status: 'PENDING', wallet, tokenIn: { chainId: 8453, tokenAddress: '0xaaa' }, amountIn: 30n },
      { status: 'PENDING', wallet, tokenIn: { chainId: 10, tokenAddress: '0xbbb' }, amountIn: 5n },
    ])

    const map = await repo.getPendingReservedByTokenForWallet(wallet)
    expect(map.get('10:0xaaa')).toEqual(10n)
    expect(map.get('10:0xbbb')).toEqual(25n)
    expect(map.get('8453:0xaaa')).toEqual(30n)
    expect(map.size).toBe(3)
  })
})


