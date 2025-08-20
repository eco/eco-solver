import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { GatewayProviderService } from './gateway-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { Hex } from 'viem'
import { serialize } from '@/common/utils/serialize'

describe('GatewayProviderService', () => {
  let service: GatewayProviderService
  let configService: jest.Mocked<EcoConfigService>
  let walletClient: jest.Mocked<WalletClientDefaultSignerService>
  let kernelClient: jest.Mocked<KernelAccountClientService>
  let sourceSigner: { signTypedData: jest.Mock }
  let destSigner: { writeContract: jest.Mock }
  let destPublic: { waitForTransactionReceipt: jest.Mock }

  const sourceChainId = 1
  const destinationChainId = 2
  const sourceDomain = 100
  const destinationDomain = 200
  const extraSourceDomain = 300
  const usdc1 = '0x1111111111111111111111111111111111111111' as Hex
  const usdc2 = '0x2222222222222222222222222222222222222222' as Hex
  const usdc3 = '0x3333333333333333333333333333333333333333' as Hex
  const wallet1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex
  const minter2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex

  const buildTokenData = (chainId: number, address: Hex, decimals = 6) => ({
    chainId,
    config: { address, chainId, minBalance: 0, targetBalance: 0, type: 'erc20' as const },
    balance: { address, decimals, balance: 1_000_000_000n },
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayProviderService,
        {
          provide: EcoConfigService,
          useValue: {
            getCache: jest.fn().mockReturnValue({ ttl: 10_000 }),
            getGatewayConfig: jest.fn().mockReturnValue({
              apiUrl: 'https://example.invalid',
              enabled: true,
              chains: [
                { chainId: sourceChainId, domain: sourceDomain, usdc: usdc1, wallet: wallet1 },
                {
                  chainId: destinationChainId,
                  domain: destinationDomain,
                  usdc: usdc2,
                  minter: minter2,
                },
                {
                  chainId: 3,
                  domain: extraSourceDomain,
                  usdc: usdc3,
                  wallet: '0xcccccccccccccccccccccccccccccccccccccccc' as Hex,
                },
              ],
            }),
          },
        },
        {
          provide: WalletClientDefaultSignerService,
          useValue: {
            getAccount: jest.fn(),
            getClient: jest.fn(),
            getPublicClient: jest.fn(),
          },
        },
        { provide: KernelAccountClientService, useValue: { getClient: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: getQueueToken(LiquidityManagerQueue.queueName), useValue: {} },
      ],
    }).compile()

    service = module.get(GatewayProviderService)
    configService = module.get(EcoConfigService) as any
    walletClient = module.get(WalletClientDefaultSignerService) as any
    kernelClient = module.get(KernelAccountClientService) as any

    // Gateway config
    configService.getGatewayConfig.mockReturnValue({
      apiUrl: 'https://example.invalid',
      enabled: true,
      chains: [
        { chainId: sourceChainId, domain: sourceDomain, usdc: usdc1, wallet: wallet1 },
        { chainId: destinationChainId, domain: destinationDomain, usdc: usdc2, minter: minter2 },
      ],
    })

    // Patch internal queue wrapper to avoid BullMQ interaction
    ;(service as any).liquidityManagerQueue = {
      startGatewayTopUp: jest.fn().mockResolvedValue(undefined),
    }

    // Patch HTTP client
    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        TransferSpec: [
          { name: 'version', type: 'uint32' },
          { name: 'sourceDomain', type: 'uint32' },
          { name: 'destinationDomain', type: 'uint32' },
          { name: 'sourceContract', type: 'bytes32' },
          { name: 'destinationContract', type: 'bytes32' },
          { name: 'sourceToken', type: 'bytes32' },
          { name: 'destinationToken', type: 'bytes32' },
          { name: 'sourceDepositor', type: 'bytes32' },
          { name: 'destinationRecipient', type: 'bytes32' },
          { name: 'sourceSigner', type: 'bytes32' },
          { name: 'destinationCaller', type: 'bytes32' },
          { name: 'value', type: 'uint256' },
          { name: 'salt', type: 'bytes32' },
          { name: 'hookData', type: 'bytes' },
        ],
        BurnIntent: [
          { name: 'maxBlockHeight', type: 'uint256' },
          { name: 'maxFee', type: 'uint256' },
          { name: 'spec', type: 'TransferSpec' },
        ],
      },
      domain: { name: 'GatewayWallet', version: '1' },
      primaryType: 'BurnIntent',
      message: {
        maxBlockHeight: '1000000',
        maxFee: '0',
        spec: {
          version: 1,
          sourceDomain,
          destinationDomain,
          sourceContract: '0x'.padEnd(66, '0'),
          destinationContract: '0x'.padEnd(66, '0'),
          sourceToken: '0x'.padEnd(66, '0'),
          destinationToken: '0x'.padEnd(66, '0'),
          sourceDepositor: '0x'.padEnd(66, '0'),
          destinationRecipient: '0x'.padEnd(66, '0'),
          sourceSigner: '0x'.padEnd(66, '0'),
          destinationCaller: '0x'.padEnd(66, '0'),
          value: '1000000',
          salt: '0x'.padEnd(66, '0'),
          hookData: '0x',
        },
      },
    }

    ;(service as any).client = {
      getBalances: jest.fn(),
      getBalancesForDepositor: jest.fn().mockResolvedValue({
        token: 'USDC',
        balances: [{ domain: sourceDomain, depositor: '0xeeee', balance: '1000000' }],
      }),
      getInfo: jest.fn().mockResolvedValue({
        domains: [
          { chain: 'src', network: 'test', domain: sourceDomain, walletContract: wallet1 },
          { chain: 'dst', network: 'test', domain: destinationDomain, minterContract: minter2 },
          {
            chain: 'src2',
            network: 'test',
            domain: extraSourceDomain,
            walletContract: '0xcccccccccccccccccccccccccccccccccccccccc',
          },
        ],
      }),
      encodeBurnIntents: jest.fn().mockResolvedValue({
        burnIntents: [
          {
            domain: sourceDomain,
            intent: typedData,
            signer: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          },
        ],
      }),
      createTransferAttestation: jest.fn().mockResolvedValue({
        attestation: '0xaaaa' as Hex,
        signature: '0xbbbb' as Hex,
        transferId: 't1',
      }),
    }

    // Wallet signer (EOA) & tx clients
    walletClient.getAccount.mockResolvedValue({
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    } as any)

    sourceSigner = { signTypedData: jest.fn().mockResolvedValue('0xsigned') }
    destSigner = { writeContract: jest.fn().mockResolvedValue('0xtx' as Hex) }
    destPublic = { waitForTransactionReceipt: jest.fn().mockResolvedValue({}) }

    walletClient.getClient.mockImplementation(async (chainId: number) => {
      if (chainId === sourceChainId) return sourceSigner as any
      return destSigner as any
    })
    walletClient.getPublicClient.mockResolvedValue(destPublic as any)

    // Kernel (recipient)
    kernelClient.getClient.mockResolvedValue({
      kernelAccount: { address: '0xdddddddddddddddddddddddddddddddddddddddd' },
    } as any)
  })

  it('getQuote returns zero-slippage USDC→USDC quote', async () => {
    const tokenIn = buildTokenData(sourceChainId, usdc1)
    const tokenOut = buildTokenData(destinationChainId, usdc2)

    const quote = await service.getQuote(tokenIn as any, tokenOut as any, 1, 'id-1')

    expect(quote.strategy).toBe('Gateway')
    expect(quote.slippage).toBe(0)
    expect(quote.amountIn).toBeGreaterThan(0n)
    expect(quote.amountOut).toBe(quote.amountIn)
    expect(quote.context.sourceDomain).toBe(sourceDomain)
    expect(quote.context.destinationDomain).toBe(destinationDomain)
  })

  it('execute signs encoded intent, mints on destination, and enqueues top-up', async () => {
    const tokenIn = buildTokenData(sourceChainId, usdc1)
    const tokenOut = buildTokenData(destinationChainId, usdc2)
    const quote = await service.getQuote(tokenIn as any, tokenOut as any, 1, 'id-2')

    const txHash = await service.execute('0xwallet', quote)

    expect(txHash).toBe('0xtx')

    // signTypedData was called to sign the locally built EIP-712 intent
    expect(sourceSigner.signTypedData).toHaveBeenCalled()
    // attestation requested
    expect((service as any).client.createTransferAttestation).toHaveBeenCalled()
    // top-up enqueued
    expect((service as any).liquidityManagerQueue.startGatewayTopUp).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: sourceChainId,
        usdc: usdc1,
        gatewayWallet: wallet1,
        depositor: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        amount: serialize(quote.amountIn),
      }),
    )
  })

  it('fee helpers compute percent fee with rounding up and domain base fee lookup', async () => {
    const svc = service as any
    // Mock config fees: 0.5 bps and domain base of 10_000 for Arbitrum(3)
    configService.getGatewayConfig.mockReturnValueOnce({
      apiUrl: 'https://example.invalid',
      enabled: true,
      chains: [],
      fees: {
        percent: { numerator: 5, denominator: 100_000 },
        base6ByDomain: { 3: 10_000 },
        fallbackBase6: 2_000_000,
      },
    })
    // Recompute internal fees cache per call via getter
    const percentFee = svc.computePercentFeeBase6(13_367_330n) // 13.367330 base6 × 0.00005 = 668.3665 → ceil = 669
    expect(percentFee.toString()).toBe('669')

    const baseFee = svc.getBaseFeeForDomainBase6(3)
    expect(baseFee.toString()).toBe('10000')
  })

  it('computeMaxTransferableOnDomain respects available = value + fee(value)', async () => {
    const svc = service as any
    // Fees: base(arb)=10_000, percent=0.5 bps
    configService.getGatewayConfig.mockReturnValueOnce({
      apiUrl: 'https://example.invalid',
      enabled: true,
      chains: [],
      fees: {
        percent: { numerator: 5, denominator: 100_000 },
        base6ByDomain: { 3: 10_000 },
        fallbackBase6: 2_000_000,
      },
    })

    // available = 13.367330 base6 → 13_367_330
    const available = 13_367_330n
    const maxVal = svc.computeMaxTransferableOnDomain(3, available)
    // fee = 10_000 + ceil(maxVal * 5 / 100000)
    const fee = svc.computeMaxFeeBase6(3, maxVal)
    expect(Number(maxVal + fee)).toBeLessThanOrEqual(Number(available))
    // if we increase by 1, it should exceed available
    const feeAtPlus1 = svc.computeMaxFeeBase6(3, maxVal + 1n)
    expect(Number(maxVal + 1n + feeAtPlus1)).toBeGreaterThan(Number(available))
  })

  it('execute sets per-intent maxFee according to config-driven computation', async () => {
    // Override config and info to use Arbitrum (domain 3) as source
    configService.getGatewayConfig.mockReturnValue({
      apiUrl: 'https://example.invalid',
      enabled: true,
      chains: [
        { chainId: sourceChainId, domain: 3, usdc: usdc1, wallet: wallet1 },
        { chainId: destinationChainId, domain: destinationDomain, usdc: usdc2, minter: minter2 },
      ],
      fees: {
        percent: { numerator: 5, denominator: 100_000 },
        base6ByDomain: { 3: 10_000 },
        fallbackBase6: 2_000_000,
      },
    })
    ;(service as any).client.getInfo.mockResolvedValueOnce({
      domains: [
        { chain: 'arb', network: 'test', domain: 3, walletContract: wallet1 },
        { chain: 'dst', network: 'test', domain: destinationDomain, minterContract: minter2 },
      ],
    })
    ;(service as any).client.getBalancesForDepositor.mockResolvedValue({
      token: 'USDC',
      balances: [{ domain: 3, depositor: '0xeeee', balance: '20' }], // 20 USDC
    })

    const tokenIn = buildTokenData(sourceChainId, usdc1)
    const tokenOut = buildTokenData(destinationChainId, usdc2)
    const quote = await service.getQuote(tokenIn as any, tokenOut as any, 1, 'id-fee-max')

    await service.execute('0xwallet', quote)
    const callArg = (service as any).client.createTransferAttestation.mock.calls[0][0]
    expect(Array.isArray(callArg)).toBe(true)
    expect(callArg.length).toBe(1)
    const msg = callArg[0].burnIntent
    const value = BigInt(msg.spec.value)
    // Expected: base(arb)=10_000 + ceil(value * 5/100000)
    const expectedMaxFee = 10_000n + (value * 5n + (100_000n - 1n)) / 100_000n
    expect(BigInt(msg.maxFee)).toBe(expectedMaxFee)
  })

  it('getQuote returns multi-source context when balance spans domains', async () => {
    // Arrange: two domains contributing to 1 USDC total
    ;(service as any).client.getBalancesForDepositor.mockResolvedValue({
      token: 'USDC',
      balances: [
        { domain: sourceDomain, depositor: '0xeeee', balance: '0.7' },
        { domain: extraSourceDomain, depositor: '0xeeee', balance: '0.5' },
      ],
    })
    // Use fee mapping for test domains (100 and 300)
    configService.getGatewayConfig.mockReturnValue({
      apiUrl: 'https://example.invalid',
      enabled: true,
      chains: [
        { chainId: sourceChainId, domain: sourceDomain, usdc: usdc1, wallet: wallet1 },
        { chainId: destinationChainId, domain: destinationDomain, usdc: usdc2, minter: minter2 },
        {
          chainId: 3,
          domain: extraSourceDomain,
          usdc: usdc3,
          wallet: '0xcccccccccccccccccccccccccccccccccccccccc' as Hex,
        },
      ],
      fees: {
        percent: { numerator: 5, denominator: 100_000 },
        base6ByDomain: { [sourceDomain]: 10_000, [extraSourceDomain]: 10_000 },
        fallbackBase6: 2_000_000,
      },
    })

    const tokenIn = buildTokenData(sourceChainId, usdc1)
    const tokenOut = buildTokenData(destinationChainId, usdc2)

    const quote = await service.getQuote(tokenIn as any, tokenOut as any, 1, 'id-multi')

    expect(quote.context.sources).toBeDefined()
    expect(quote.context.sources!.length).toBeGreaterThan(1)
    const sum = quote.context.sources!.reduce((acc, s) => acc + s.amountBase6, 0n)
    expect(sum).toEqual(quote.context.amountBase6)
  })

  it('execute builds multiple intents and posts array when context.sources present', async () => {
    // Arrange: make getQuote produce multi-sources then execute
    ;(service as any).client.getBalancesForDepositor.mockResolvedValueOnce({
      token: 'USDC',
      balances: [
        { domain: sourceDomain, depositor: '0xeeee', balance: '0.7' },
        { domain: extraSourceDomain, depositor: '0xeeee', balance: '0.5' },
      ],
    })

    const tokenIn = buildTokenData(sourceChainId, usdc1)
    const tokenOut = buildTokenData(destinationChainId, usdc2)
    const quote = await service.getQuote(tokenIn as any, tokenOut as any, 1, 'id-exec-multi')

    await service.execute('0xwallet', quote)

    const callArg = (service as any).client.createTransferAttestation.mock.calls[0][0]
    expect(Array.isArray(callArg)).toBe(true)
    expect(callArg.length).toBe(quote.context.sources!.length)
  })
})
