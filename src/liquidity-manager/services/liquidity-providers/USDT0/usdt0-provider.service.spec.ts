import { USDT0ProviderService } from '@/liquidity-manager/services/liquidity-providers/USDT0/usdt0-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'

describe('USDT0ProviderService', () => {
  let svc: USDT0ProviderService

  const eco = {
    getUSDT0: jest.fn().mockReturnValue({
      chains: [
        {
          chainId: 1,
          eid: 30101,
          type: 'adapter',
          contract: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          decimals: 6,
          underlyingToken: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
        {
          chainId: 42161,
          eid: 30110,
          type: 'oft',
          contract: '0xcccccccccccccccccccccccccccccccccccccccc',
          decimals: 6,
        },
      ],
    }),
  } as unknown as jest.Mocked<EcoConfigService>

  const kernel = {
    getClient: jest.fn(),
    getAddress: jest.fn(),
  } as unknown as jest.Mocked<LmTxGatedKernelAccountClientService>

  const pub = {
    getClient: jest.fn(),
  } as unknown as jest.Mocked<MultichainPublicClientService>

  // Provide a dummy queue; we will spy on LiquidityManagerQueue.startOFTDeliveryCheck
  const queue: any = {}
  const repo = { updateStatus: jest.fn() } as unknown as jest.Mocked<RebalanceRepository>

  beforeEach(() => {
    jest.resetAllMocks()
    ;(kernel.getAddress as any).mockResolvedValue('0x1111111111111111111111111111111111111111')
    ;(eco.getUSDT0 as any).mockReturnValue({
      chains: [
        {
          chainId: 1,
          eid: 30101,
          type: 'adapter',
          contract: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          decimals: 6,
          underlyingToken: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
        {
          chainId: 42161,
          eid: 30110,
          type: 'oft',
          contract: '0xcccccccccccccccccccccccccccccccccccccccc',
          decimals: 6,
        },
      ],
    })
    svc = new USDT0ProviderService(eco, kernel, pub, repo, queue)
  })

  describe('getQuote', () => {
    it('returns 1:1 amounts with context and strategy USDT0', async () => {
      const tokenIn: any = {
        chainId: 1,
        config: { chainId: 1, address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const tokenOut: any = {
        chainId: 42161,
        config: { chainId: 42161, address: '0xdddddddddddddddddddddddddddddddddddddddd' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }

      const quote = await svc.getQuote(tokenIn, tokenOut, 1000000)

      expect(quote.strategy).toBe('USDT0')
      const expected = 1000000n * 1000000n // 1,000,000 base-6
      expect(quote.amountIn).toBe(expected)
      expect(quote.amountOut).toBe(expected)
      expect(quote.context).toMatchObject({
        sourceEid: 30101,
        destinationEid: 30110,
      })
    })

    it('throws when chain pair unsupported', async () => {
      const tokenIn: any = {
        chainId: 8453,
        config: { chainId: 8453, address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const tokenOut: any = {
        chainId: 42161,
        config: { chainId: 42161, address: '0xdddddddddddddddddddddddddddddddddddddddd' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      await expect(svc.getQuote(tokenIn, tokenOut, 1)).rejects.toThrow(
        'USDT0 unsupported chain pair',
      )
    })
  })

  describe('execute', () => {
    it('quotes fee, executes send, and enqueues delivery check', async () => {
      const tokenIn: any = {
        chainId: 1,
        config: { chainId: 1, address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const tokenOut: any = {
        chainId: 42161,
        config: { chainId: 42161, address: '0xdddddddddddddddddddddddddddddddddddddddd' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const quote = await svc.getQuote(tokenIn, tokenOut, 1000000)

      // mock public client readContract for quoteOFT and quoteSend
      const readContract = jest
        .fn()
        // quoteOFT
        .mockResolvedValueOnce({ receipt: { amountReceivedLD: 1000000n } })
        // quoteSend
        .mockResolvedValueOnce({ nativeFee: 1234n, lzTokenFee: 0n })
      ;(pub.getClient as any) = jest.fn().mockResolvedValue({ readContract })

      // mock kernel execute
      const execute = jest.fn().mockResolvedValue('0xtxhash')
      ;(kernel.getClient as any) = jest.fn().mockResolvedValue({ execute })

      // spy on queue starter
      const startSpy = jest
        .spyOn(LiquidityManagerQueue.prototype as any, 'startOFTDeliveryCheck')
        .mockResolvedValue(undefined)

      const tx = await svc.execute('0x1111111111111111111111111111111111111111', quote as any)
      expect(tx).toBe('0xtxhash')
      expect(execute).toHaveBeenCalled()
      expect(startSpy).toHaveBeenCalled()
    })

    it('on adapter: includes approve then send calls', async () => {
      const tokenIn: any = {
        chainId: 1,
        config: { chainId: 1, address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const tokenOut: any = {
        chainId: 42161,
        config: { chainId: 42161, address: '0xdddddddddddddddddddddddddddddddddddddddd' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const quote = await svc.getQuote(tokenIn, tokenOut, 1000000)

      const readContract = jest
        .fn()
        .mockResolvedValueOnce({ receipt: { amountReceivedLD: 1000000n } })
        .mockResolvedValueOnce({ nativeFee: 0n, lzTokenFee: 0n })
      ;(pub.getClient as any) = jest.fn().mockResolvedValue({ readContract })

      const execute = jest.fn().mockImplementation(async (calls: any[]) => {
        expect(Array.isArray(calls)).toBe(true)
        expect(calls[0].to).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') // approve underlying USDT
        expect(calls[1].to).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') // send on adapter
        return '0xtx'
      })
      ;(kernel.getClient as any) = jest.fn().mockResolvedValue({ execute })

      jest
        .spyOn(LiquidityManagerQueue.prototype as any, 'startOFTDeliveryCheck')
        .mockResolvedValue(undefined)
      await svc.execute('0x1111111111111111111111111111111111111111', quote as any)
      expect(execute).toHaveBeenCalled()
    })

    it('on non-adapter: skips approve call', async () => {
      // Reconfigure eco.getUSDT0 to set source as Arbitrum (oft)
      ;(eco.getUSDT0 as any).mockReturnValueOnce({
        chains: [
          {
            chainId: 1,
            eid: 30101,
            type: 'adapter',
            contract: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            decimals: 6,
            underlyingToken: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
          {
            chainId: 42161,
            eid: 30110,
            type: 'oft',
            contract: '0xcccccccccccccccccccccccccccccccccccccccc',
            decimals: 6,
          },
        ],
      })
      const tokenIn: any = {
        chainId: 42161,
        config: { chainId: 42161, address: '0xdddddddddddddddddddddddddddddddddddddddd' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const tokenOut: any = {
        chainId: 1,
        config: { chainId: 1, address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const quote = await svc.getQuote(tokenIn, tokenOut, 1000000)

      const readContract = jest
        .fn()
        .mockResolvedValueOnce({ receipt: { amountReceivedLD: 1000000n } })
        .mockResolvedValueOnce({ nativeFee: 0n, lzTokenFee: 0n })
      ;(pub.getClient as any) = jest.fn().mockResolvedValue({ readContract })
      const execute = jest.fn().mockResolvedValue('0xtx')
      ;(kernel.getClient as any) = jest.fn().mockResolvedValue({ execute })
      jest
        .spyOn(LiquidityManagerQueue.prototype as any, 'startOFTDeliveryCheck')
        .mockResolvedValue(undefined)

      await svc.execute('0x1111111111111111111111111111111111111111', quote as any)
      const calls = (execute as any).mock.calls[0][0]
      expect(calls.length).toBe(1)
      expect(calls[0].to).toBe('0xcccccccccccccccccccccccccccccccccccccccc')
    })

    it('minAmountLD is taken from quoteOFT into subsequent quoteSend', async () => {
      const tokenIn: any = {
        chainId: 1,
        config: { chainId: 1, address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const tokenOut: any = {
        chainId: 42161,
        config: { chainId: 42161, address: '0xdddddddddddddddddddddddddddddddddddddddd' },
        balance: { address: '0x1111111111111111111111111111111111111111', decimals: 6 },
      }
      const quote = await svc.getQuote(tokenIn, tokenOut, 1000000)

      const readContract = jest
        .fn()
        // quoteOFT: return slightly less than amount
        .mockResolvedValueOnce({ receipt: { amountReceivedLD: 999000n } })
        // quoteSend: capture args
        .mockResolvedValueOnce({ nativeFee: 0n, lzTokenFee: 0n })
      ;(pub.getClient as any) = jest.fn().mockResolvedValue({ readContract })
      ;(kernel.getClient as any) = jest
        .fn()
        .mockResolvedValue({ execute: jest.fn().mockResolvedValue('0xtx') })
      jest
        .spyOn(LiquidityManagerQueue.prototype as any, 'startOFTDeliveryCheck')
        .mockResolvedValue(undefined)

      await svc.execute('0x1111111111111111111111111111111111111111', quote as any)

      // Assert second call to readContract used minAmountLD = 999000
      const secondArgs = readContract.mock.calls[1][0]?.args?.[0]
      expect(secondArgs?.minAmountLD).toBe(999000n)
    })
  })
})
