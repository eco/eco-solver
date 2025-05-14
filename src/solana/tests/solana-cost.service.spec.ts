import { Test, TestingModule } from '@nestjs/testing'
import { SolanaCostService } from '@/solana/solana-cost.service'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { SolanaFulfillService } from '@/intent/solana-fulfill-intent.service'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

/*
 * Create a fake 200-byte SPL-token account buffer whose `amount` (u64 LE)
 * is written at offset 64. Then we base64-encode it
 */
function buildTokenAccountB64Balance(amount: bigint): string {
  const buf = Buffer.alloc(200, 0)
  buf.writeBigUInt64LE(amount, 64)
  return buf.toString('base64')
}

jest.mock('@solana/spl-token', () => {
  const real = jest.requireActual('@solana/spl-token')
  return {
    ...real,
    getAssociatedTokenAddressSync: (mint: PublicKey, owner: PublicKey) =>
      new PublicKey(
        PublicKey.default.toBuffer().map((_, i) => mint.toBuffer()[i] ^ owner.toBuffer()[i]),
      ),
  }
})

const mockGetAccountInfo = jest.fn()
const mockGetTokenAccountBalance = jest.fn()
const mockSimulateTransaction = jest.fn()
const mockGetLatestBlockhash = jest.fn()

jest.mock('@solana/web3.js', () => {
  const real = jest.requireActual('@solana/web3.js')
  return {
    ...real,
    Connection: jest.fn().mockImplementation(() => ({
      getAccountInfo: mockGetAccountInfo,
      getTokenAccountBalance: mockGetTokenAccountBalance,
      simulateTransaction: mockSimulateTransaction,
      getLatestBlockhash: mockGetLatestBlockhash,
    })),
  }
})

const mockBuildFulfilIxs = jest.fn()
const FulfilBuilderMock = {
  buildFulfillIntentIxs: mockBuildFulfilIxs,
  hex32ToBuf: (hex: string) => Buffer.from(hex.replace(/^0x/, '').padStart(64, '0'), 'hex'),
} as unknown as SolanaFulfillService

describe('SolanaCostService', () => {
  let service: SolanaCostService
  const solver = new PublicKey('So11111111111111111111111111111111111111112')
  const mint = new PublicKey('Token111111111111111111111111111111111111111')

  const fakeIntent: any = {
    hash: '0xdeadbeef',
    route: {
      calls: [],
      tokens: [
        {
          token: '0x' + mint.toBuffer().toString('hex'),
          amount: 123n,
        },
      ],
    },
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockGetAccountInfo.mockResolvedValue({
      lamports: LAMPORTS_PER_SOL, // 1 SOL
    })

    mockGetTokenAccountBalance.mockResolvedValue({
      value: { amount: '777' },
    })

    mockGetLatestBlockhash.mockResolvedValue({ blockhash: 'abc', lastValidBlockHeight: 999 })
    mockBuildFulfilIxs.mockResolvedValue([{}])

    // simulateTransaction RPC response
    mockSimulateTransaction.mockResolvedValue({
      value: {
        err: null,
        unitsConsumed: 1_000,
        accounts: [
          /* index-0: system account after tx */
          { lamports: 1_000_000_000 - 500 + 1_000 }, // 500 - outflow, 1_000 - fees
          /* index-1: solver ATA after tx (777-123 = 654) */
          {
            data: [buildTokenAccountB64Balance(654n)],
            executable: false,
            lamports: 0,
            owner: mint.toString(),
          },
        ],
      },
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolanaCostService,
        { provide: Connection, useValue: new (require('@solana/web3.js').Connection)('') },
        { provide: SolanaFulfillService, useValue: FulfilBuilderMock },
      ],
    }).compile()

    service = module.get(SolanaCostService)
  })

  it('returns correct SimulationResult', async () => {
    const result = await service.simulateIntent(fakeIntent, solver)
    const expectedAta = getAssociatedTokenAddressSync(mint, solver).toBase58()

    expect(result.solverLamports).toBe(1_000_000_000n)
    expect(result.lamportsOut).toBe(500n) // pre - post + fee
    expect(result.tokenOut[mint.toBase58()]).toBe(123n)
    expect(result.solverTokenAmounts).toEqual({
      [expectedAta]: 777n,
    })

    // Called helpers
    expect(mockBuildFulfilIxs).toHaveBeenCalled()
    expect(mockSimulateTransaction).toHaveBeenCalled()
  })

  it('throws if simulation returns error', async () => {
    mockSimulateTransaction.mockResolvedValueOnce({
      value: { err: 'Boom' },
    })
    await expect(service.simulateIntent(fakeIntent, solver)).rejects.toThrow(/Error/)
  })

  it('throws if token outflow mismatches intent amount', async () => {
    // modify simulate response to send 100 (not 123)
    const wrongTokenB64 = buildTokenAccountB64Balance(777n - 100n)
    mockSimulateTransaction.mockResolvedValueOnce({
      value: {
        err: null,
        unitsConsumed: 1_000,
        accounts: [
          { lamports: 1_000_000_000 - 500 + 1_000 },
          { data: [wrongTokenB64], lamports: 0, owner: mint.toString(), executable: false },
        ],
      },
    })

    await expect(service.simulateIntent(fakeIntent, solver)).rejects.toThrow(/outflow/)
  })
})
