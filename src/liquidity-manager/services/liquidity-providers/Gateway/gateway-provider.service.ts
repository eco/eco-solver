import { Inject, Injectable, Logger } from '@nestjs/common'
import { Hex, isAddressEqual, pad, parseUnits, toHex, keccak256 } from 'viem'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { convertNormScalar, deconvertNormScalar } from '@/fee/utils'
import { GatewayHttpClient } from './utils/gateway-client'
import { GatewayQuoteValidationError } from './gateway.errors'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Cache } from '@nestjs/cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cacheable } from '@/decorators/cacheable.decorator'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { InjectQueue } from '@nestjs/bullmq'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { serialize } from '@/common/utils/serialize'
import { gatewayMinterAbi } from './constants/abis'

@Injectable()
export class GatewayProviderService implements IRebalanceProvider<'Gateway'> {
  private logger = new Logger(GatewayProviderService.name)
  private client: GatewayHttpClient
  // cacheManager and configService are required by @Cacheable decorator
  private liquidityManagerQueue: LiquidityManagerQueue

  // Fees configuration helpers (config-driven with robust defaults)
  private getGatewayFeesConfig(): {
    percent: { numerator: bigint; denominator: bigint }
    base6ByDomain: Record<number, bigint>
    fallbackBase6: bigint
  } {
    const cfg = this.configService.getGatewayConfig()
    const defaultBase: Record<number, bigint> = {
      // Ethereum
      0: 2_000_000n,
      // Avalanche
      1: 20_000n,
      // OP
      2: 1_500n,
      // Arbitrum
      3: 10_000n,
      // Base
      6: 10_000n,
      // Polygon PoS
      7: 1_500n,
      // Unichain
      10: 1_000n,
    }
    const percent = cfg.fees?.percent
      ? {
          numerator: BigInt(cfg.fees.percent.numerator),
          denominator: BigInt(cfg.fees.percent.denominator),
        }
      : { numerator: 5n, denominator: 100_000n } // 0.5 bps
    const base6ByDomain: Record<number, bigint> = { ...defaultBase }
    if (cfg.fees?.base6ByDomain) {
      for (const [k, v] of Object.entries(cfg.fees.base6ByDomain)) {
        base6ByDomain[Number(k)] = BigInt(v as any)
      }
    }
    const fallbackBase6 = cfg.fees?.fallbackBase6
      ? BigInt(cfg.fees.fallbackBase6 as any)
      : 2_000_000n // conservative fallback to Ethereum base fee
    return { percent, base6ByDomain, fallbackBase6 }
  }

  private computePercentFee(value: bigint): bigint {
    if (value <= 0n) return 0n
    const { numerator, denominator } = this.getGatewayFeesConfig().percent
    return (value * numerator + (denominator - 1n)) / denominator
  }

  private getBaseFeeForDomain(domain: number, tokenDecimals: number): bigint {
    const fees = this.getGatewayFeesConfig()
    const baseFeeBase6 = fees.base6ByDomain[domain] ?? fees.fallbackBase6
    // Convert from base-6 to token's native decimals
    const baseFeeNormalized = convertNormScalar(baseFeeBase6, 6)
    return deconvertNormScalar(baseFeeNormalized, tokenDecimals)
  }

  private computeMaxFee(domain: number, value: bigint, tokenDecimals: number): bigint {
    const base = this.getBaseFeeForDomain(domain, tokenDecimals)
    const percent = this.computePercentFee(value)
    return base + percent
  }

  // Find the maximum transferable amount on a domain such that value + fee(value) <= available
  // Uses binary search for monotonic function value + fee(value)
  private computeMaxTransferableOnDomain(
    domain: number,
    available: bigint,
    tokenDecimals: number,
    cap?: bigint,
  ): bigint {
    const baseFee = this.getBaseFeeForDomain(domain, tokenDecimals)
    if (available <= baseFee) return 0n
    let lo = 0n
    let hi = available - baseFee
    if (cap !== undefined && cap >= 0n) hi = hi < cap ? hi : cap

    const fits = (val: bigint) => val + this.computeMaxFee(domain, val, tokenDecimals) <= available

    while (lo < hi) {
      const mid = lo + (hi - lo + 1n) / 2n
      if (fits(mid)) {
        lo = mid
      } else {
        hi = mid - 1n
      }
    }
    return lo
  }

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: EcoConfigService,
    private readonly walletClientService: WalletClientDefaultSignerService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    const cfg = this.configService.getGatewayConfig()
    this.client = new GatewayHttpClient(cfg.apiUrl)
    this.liquidityManagerQueue = new LiquidityManagerQueue(this.queue)
  }

  getStrategy() {
    return 'Gateway' as const
  }

  /**
   * One-time bootstrap: if enabled and unified balance is zero on the configured domain,
   * enqueue a single GATEWAY_TOP_UP with a fixed amount from Kernel via depositFor.
   */
  async ensureBootstrapOnce(id: string = 'bootstrap'): Promise<void> {
    const cfg = this.configService.getGatewayConfig()
    const bootstrap = cfg.bootstrap
    if (!bootstrap?.enabled) return

    const chain = cfg.chains.find((c) => c.chainId === bootstrap.chainId)
    if (!chain) return

    const depositor = (await this.walletClientService.getAccount()).address as Hex
    // Check balance on the unified account for this domain
    const bal = await this.client.getBalances({
      token: 'USDC',
      sources: [{ domain: chain.domain, depositor }],
    })
    const entry = bal.balances.find((b) => b.domain === chain.domain)
    const isZero = !entry || entry.balance === '0'
    if (!isZero) return

    // Resolve GatewayWallet address
    const gatewayInfo = await this.getSupportedDomains(false)
    const walletAddr =
      (chain.wallet as Hex | undefined) ||
      (gatewayInfo.find((d) => d.domain === chain.domain)?.wallet as Hex | undefined)
    if (!walletAddr) return

    // Convert bootstrap amount from base-6 to chain's USDC decimals
    const amountBase6 = BigInt(bootstrap.amountBase6)
    const amountNormalized = convertNormScalar(amountBase6, 6)
    // Assume USDC has 6 decimals on most chains, but allow for flexibility
    const usdcDecimals = 6 // Default USDC decimals - could be made configurable
    const amount = deconvertNormScalar(amountNormalized, usdcDecimals)
    await this.liquidityManagerQueue.startGatewayTopUp({
      chainId: chain.chainId,
      usdc: chain.usdc,
      gatewayWallet: walletAddr,
      amount: serialize(amount),
      depositor,
      id,
    })
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmountBased: bigint,
    id?: string,
  ): Promise<RebalanceQuote<'Gateway'>> {
    const cfg = this.configService.getGatewayConfig()
    if (cfg.enabled === false) {
      throw new GatewayQuoteValidationError('Gateway provider is disabled')
    }

    if (tokenIn.chainId === tokenOut.chainId) {
      throw new GatewayQuoteValidationError('Same-chain route not supported for Gateway')
    }

    const inChain = cfg.chains.find((c) => c.chainId === tokenIn.chainId)
    const outChain = cfg.chains.find((c) => c.chainId === tokenOut.chainId)
    if (!inChain || !outChain) {
      throw new GatewayQuoteValidationError('Unsupported chain pair for Gateway', {
        in: tokenIn.chainId,
        out: tokenOut.chainId,
      })
    }

    // Validate both tokens are configured USDC addresses
    if (
      !isAddressEqual(tokenIn.config.address, inChain.usdc) ||
      !isAddressEqual(tokenOut.config.address, outChain.usdc)
    ) {
      throw new GatewayQuoteValidationError('Only USDC→USDC routes are supported')
    }

    // swapAmountBased is already in BASE_DECIMALS, convert to token decimals for Gateway
    const tokenInDecimals = tokenIn.balance.decimals.original
    const tokenOutDecimals = tokenOut.balance.decimals.original

    // Convert from BASE_DECIMALS to token's native decimals
    const amountIn = deconvertNormScalar(swapAmountBased, tokenInDecimals)
    const amountOut = deconvertNormScalar(swapAmountBased, tokenOutDecimals)

    // For Gateway API calls, use the native decimals amount
    const amountForGateway = amountIn

    // Validate chain support using Gateway info
    await this.ensureDomainsSupported(inChain.domain, outChain.domain, id)

    // Ensure sufficient unified balance at Gateway for the depositor (EOA)
    await this.ensureSufficientUnifiedBalance(amountForGateway, tokenInDecimals, id)

    // Determine source domains to use based on actual per-domain balances
    const sources = await this.selectSourcesForAmount(amountForGateway, tokenInDecimals, id)
    const chosenSourceDomain = sources[0].domain

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Gateway: building zero-slippage quote',
        id,
        properties: {
          chosenSourceDomain,
          destinationDomain: outChain.domain,
          amountForGateway: amountForGateway.toString(),
          tokenDecimals: tokenInDecimals,
          sources: sources.map((s) => {
            const fee = this.computeMaxFee(s.domain, s.amount, tokenInDecimals)
            return `${s.domain}:${s.amount.toString()}(+fee:${fee.toString()})`
          }),
        },
      }),
    )

    const percentCfg = this.getGatewayFeesConfig().percent
    // Slippage reported in percentage units (e.g., 0.005 means 0.005%)
    const slippagePercent = (Number(percentCfg.numerator) / Number(percentCfg.denominator)) * 100
    const quote: RebalanceQuote<'Gateway'> = {
      amountIn: amountIn,
      amountOut: amountOut,
      slippage: slippagePercent,
      tokenIn,
      tokenOut,
      strategy: 'Gateway',
      context: {
        sourceDomain: chosenSourceDomain,
        destinationDomain: outChain.domain,
        amountInNormalized: swapAmountBased,
        sources,
        id,
      },
      id,
    }

    return quote
  }

  // Select per-domain sources that cover the requested amount, fee-aware
  private async selectSourcesForAmount(
    amount: bigint,
    tokenDecimals: number,
    id?: string,
  ): Promise<{ domain: number; amount: bigint }[]> {
    const depositor = (await this.walletClientService.getAccount()).address as Hex
    const balanceResp = await this.client.getBalancesForDepositor('USDC', depositor)

    const perDomain = (balanceResp?.balances || [])
      .map((b) => ({ domain: b.domain, available: parseUnits(b.balance || '0', tokenDecimals) }))
      .sort((a, b) => (a.available < b.available ? 1 : a.available > b.available ? -1 : 0))

    const sources: { domain: number; amount: bigint }[] = []
    let remaining = amount
    for (const entry of perDomain) {
      if (remaining <= 0n) break
      if (entry.available <= 0n) continue
      const maxOnDomain = this.computeMaxTransferableOnDomain(
        entry.domain,
        entry.available,
        tokenDecimals,
        remaining,
      )
      if (maxOnDomain > 0n) {
        sources.push({ domain: entry.domain, amount: maxOnDomain })
        remaining -= maxOnDomain
      }
    }

    if (remaining > 0n || !sources.length) {
      throw new GatewayQuoteValidationError(
        'Insufficient Gateway unified balance after selection',
        {
          remaining: remaining.toString(),
          requested: amount.toString(),
          tokenDecimals,
        },
      )
    }

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Gateway: selected sources',
        id,
        properties: {
          requested: amount.toString(),
          tokenDecimals,
          sources: sources.map((s) => {
            const fee = this.computeMaxFee(s.domain, s.amount, tokenDecimals)
            return `${s.domain}:${s.amount.toString()}(+fee:${fee.toString()})`
          }),
        },
      }),
    )

    return sources
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'Gateway'>): Promise<string> {
    const { destinationDomain, amountInNormalized, sources: contextSources, id } = quote.context

    // Convert normalized amount back to token's native decimals for Gateway operations
    const tokenDecimals = quote.tokenIn.balance.decimals.original
    const amountForGateway = deconvertNormScalar(amountInNormalized, tokenDecimals)

    // Resolve addresses
    const eoa = await this.walletClientService.getAccount()
    const eoaAddress = eoa.address as Hex
    const kernelClient = await this.kernelAccountClientService.getClient(quote.tokenOut.chainId)
    const kernelAddress = kernelClient.kernelAccount.address as Hex

    // Resolve Gateway config for tokens
    const cfg = this.configService.getGatewayConfig()
    const inChainCfg = cfg.chains.find((c) => c.chainId === quote.tokenIn.chainId)
    const outChainCfg = cfg.chains.find((c) => c.chainId === quote.tokenOut.chainId)
    if (!inChainCfg || !outChainCfg) {
      throw new Error('Gateway: Missing chain config for encode payload')
    }

    // 0) Re-validate sufficient unified balance (protect against race conditions)
    await this.ensureSufficientUnifiedBalance(amountForGateway, tokenDecimals)

    // 1) Build one or more EIP-712 burn-intent typed data items based on sources
    const destinationMinter = await this.getMinterAddress(destinationDomain)
    const sources =
      contextSources && contextSources.length
        ? contextSources
        : [{ domain: quote.context.sourceDomain, amount: amountForGateway }]

    const signerClient = await this.walletClientService.getClient(quote.tokenIn.chainId)
    const transferItems: Array<{ burnIntent: any; signature: Hex }> = []

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Gateway: preparing transfer items',
        id,
        properties: {
          sources: sources.map((s) => `${s.domain}:${s.amount.toString()}`),
          totalAmount: amountForGateway.toString(),
          tokenDecimals,
          items: sources.length,
        },
      }),
    )

    // Build burn intents for each source domain
    for (const src of sources) {
      const sourceWallet = await this.getWalletAddress(src.domain)
      const srcChainCfg = cfg.chains.find((c) => c.domain === src.domain)
      if (!srcChainCfg) {
        throw new Error(`Gateway: Missing chain config for source domain ${src.domain}`)
      }
      const maxFeeForIntent = this.computeMaxFee(src.domain, src.amount, tokenDecimals)
      const typedData = this.buildBurnIntentTypedData({
        sourceDomain: src.domain,
        destinationDomain,
        sourceContract: sourceWallet,
        destinationContract: destinationMinter,
        sourceToken: srcChainCfg.usdc,
        destinationToken: outChainCfg.usdc,
        sourceDepositor: eoaAddress,
        destinationRecipient: kernelAddress,
        sourceSigner: eoaAddress,
        destinationCaller: '0x0000000000000000000000000000000000000000' as Hex,
        value: src.amount,
        salt: keccak256(
          toHex(`${Date.now()}-${id ?? ''}-${eoaAddress}-${src.domain}-${src.amount.toString()}`),
        ) as Hex,
        hookData: '0x',
        maxBlockHeight: BigInt(10_000_000_000),
        maxFee: maxFeeForIntent,
      })
      const signature: Hex = await (signerClient as any).signTypedData(typedData)
      transferItems.push({ burnIntent: (typedData as any).message, signature })

      this.logger.debug(
        EcoLogMessage.withId({
          message: 'Gateway: signed burn intent',
          id,
          properties: {
            sourceDomain: src.domain,
            value: src.amount.toString(),
            maxFee: maxFeeForIntent.toString(),
          },
        }),
      )
    }

    // 2) Request attestation from Gateway API using an array of burn intents
    const attestationResp = await this.client.createTransferAttestation(transferItems as any)
    if ('message' in attestationResp) {
      throw new Error(`Gateway attestation error: ${attestationResp.message}`)
    }
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Gateway: attestation received',
        id,
        properties: {
          items: transferItems.length,
          hasTransferId: !!(attestationResp as any).transferId,
        },
      }),
    )

    // 3) Mint on destination
    const minterAddress = await this.getMinterAddress(destinationDomain)
    const destWalletClient = await this.walletClientService.getClient(quote.tokenOut.chainId)
    const destPublicClient = await this.walletClientService.getPublicClient(quote.tokenOut.chainId)

    const txHash = await destWalletClient.writeContract({
      abi: gatewayMinterAbi,
      address: minterAddress,
      functionName: 'gatewayMint',
      args: [attestationResp.attestation, attestationResp.signature],
    })
    await destPublicClient.waitForTransactionReceipt({ hash: txHash })

    this.logger.log(
      EcoLogMessage.withId({
        message: 'Gateway: Minted on destination',
        id,
        properties: {
          txHash,
          chainId: quote.tokenOut.chainId,
          depositor: eoaAddress,
          recipient: kernelAddress,
        },
      }),
    )

    // Enqueue top-up of unified balance from Kernel via depositFor to EOA (on tokenIn chain)
    const inChainTopUp = this.configService
      .getGatewayConfig()
      .chains.find((c) => c.chainId === quote.tokenIn.chainId)
    const gatewayInfo = await this.getSupportedDomains(false)
    const walletAddr =
      (inChainTopUp?.['wallet'] as Hex | undefined) ||
      (gatewayInfo.find((d) => d.domain === inChainTopUp?.domain)?.wallet as Hex | undefined)

    if (inChainTopUp?.usdc && walletAddr) {
      await this.liquidityManagerQueue.startGatewayTopUp({
        chainId: quote.tokenIn.chainId,
        usdc: inChainTopUp.usdc,
        gatewayWallet: walletAddr,
        amount: serialize(quote.amountIn),
        depositor: eoaAddress,
        id,
      })
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'Gateway: top-up job enqueued',
          id,
          properties: {
            chainId: quote.tokenIn.chainId,
            amount: quote.amountIn.toString(),
            gatewayWallet: walletAddr,
          },
        }),
      )
    } else {
      this.logger.warn(
        EcoLogMessage.withId({
          message: 'Gateway: Skipping top-up enqueue (missing usdc or GatewayWallet address)',
          id,
          properties: { chainId: quote.tokenIn.chainId },
        }),
      )
    }

    return txHash
  }

  @Cacheable({
    ttl: 60 * 60 * 1000, // 1 hour
    bypassArgIndex: 0,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getSupportedDomains(_forceRefresh = false) {
    const info = await this.client.getInfo()
    const domains = info.domains.map((d) => ({
      domain: d.domain,
      wallet: d.walletContract,
      minter: d.minterContract,
    }))
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'Gateway: fetched supported domains',
        properties: { domains },
      }),
    )
    return domains
  }

  private async ensureDomainsSupported(
    sourceDomain: number,
    destinationDomain: number,
    id?: string,
  ) {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Gateway: validating domain support',
        id,
        properties: { sourceDomain, destinationDomain },
      }),
    )
    const domains = await this.getSupportedDomains(false)
    const src = domains.find((d) => d.domain === sourceDomain)
    const dst = domains.find((d) => d.domain === destinationDomain)
    if (!src || !src.wallet) {
      throw new GatewayQuoteValidationError(
        'Source domain not supported by Gateway (wallet missing)',
        {
          sourceDomain,
        },
      )
    }
    if (!dst || !dst.minter) {
      throw new GatewayQuoteValidationError(
        'Destination domain not supported by Gateway (minter missing)',
        {
          destinationDomain,
        },
      )
    }
  }

  private async getMinterAddress(destinationDomain: number): Promise<Hex> {
    const cfg = this.configService.getGatewayConfig()
    const fromConfig = cfg.chains.find((c) => c.domain === destinationDomain)?.minter as
      | Hex
      | undefined
    if (fromConfig) return fromConfig
    const domains = await this.getSupportedDomains(false)
    const match = domains.find((d) => d.domain === destinationDomain)
    if (!match?.minter) throw new Error(`Gateway minter not found for domain ${destinationDomain}`)
    return match.minter as Hex
  }

  private async ensureSufficientUnifiedBalance(
    required: bigint,
    tokenDecimals: number,
    id?: string,
  ) {
    const depositor = (await this.walletClientService.getAccount()).address as Hex
    const balanceResp = await (this.client as any).getBalancesForDepositor('USDC', depositor)

    const domainToBalance = new Map<number, bigint>()
    for (const b of balanceResp?.balances || []) {
      domainToBalance.set(b.domain, parseUnits(b.balance || '0', tokenDecimals))
    }
    const available = Array.from(domainToBalance.values()).reduce((acc, v) => acc + v, 0n)

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Gateway: checking unified balance across domains',
        id,
        properties: {
          required: required.toString(),
          available: available.toString(),
          tokenDecimals,
          depositor,
          perDomain: Object.fromEntries(
            Array.from(domainToBalance.entries()).map(([d, v]) => [d, v.toString()]),
          ),
        },
      }),
    )

    if (available < required) {
      this.logger.warn(
        EcoLogMessage.withId({
          message: 'Gateway: Insufficient unified balance (across all domains)',
          id,
          properties: {
            required: required.toString(),
            available: available.toString(),
            tokenDecimals,
            depositor,
          },
        }),
      )
      throw new GatewayQuoteValidationError('Insufficient Gateway unified balance', {
        requested: required.toString(),
        available: available.toString(),
        tokenDecimals,
        depositor,
        perDomain: Object.fromEntries(
          Array.from(domainToBalance.entries()).map(([d, v]) => [d, v.toString()]),
        ),
      })
    }
  }

  private async getWalletAddress(sourceDomain: number): Promise<Hex> {
    const cfg = this.configService.getGatewayConfig()
    const fromConfig = cfg.chains.find((c) => c.domain === sourceDomain)?.wallet as Hex | undefined
    if (fromConfig) return fromConfig
    const domains = await this.getSupportedDomains(false)
    const match = domains.find((d) => d.domain === sourceDomain)
    if (!match?.wallet) throw new Error(`Gateway wallet not found for domain ${sourceDomain}`)
    return match.wallet as Hex
  }

  private buildBurnIntentTypedData(params: {
    sourceDomain: number
    destinationDomain: number
    sourceContract: Hex
    destinationContract: Hex
    sourceToken: Hex
    destinationToken: Hex
    sourceDepositor: Hex
    destinationRecipient: Hex
    sourceSigner: Hex
    destinationCaller: Hex
    value: bigint
    salt: Hex
    hookData: Hex
    maxBlockHeight: bigint
    maxFee: bigint
  }) {
    const toBytes32 = (addr: Hex) => pad(addr, { size: 32 })
    const types = {
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
    } as const

    const domain = { name: 'GatewayWallet', version: '1' } as const

    const message = {
      maxBlockHeight: params.maxBlockHeight.toString(),
      maxFee: params.maxFee.toString(),
      spec: {
        version: 1,
        sourceDomain: params.sourceDomain,
        destinationDomain: params.destinationDomain,
        sourceContract: toBytes32(params.sourceContract),
        destinationContract: toBytes32(params.destinationContract),
        sourceToken: toBytes32(params.sourceToken),
        destinationToken: toBytes32(params.destinationToken),
        sourceDepositor: toBytes32(params.sourceDepositor),
        destinationRecipient: toBytes32(params.destinationRecipient),
        sourceSigner: toBytes32(params.sourceSigner),
        destinationCaller: toBytes32(params.destinationCaller),
        value: params.value.toString(),
        salt: params.salt,
        hookData: params.hookData,
      },
    }

    return {
      types,
      domain,
      primaryType: 'BurnIntent',
      message,
    }
  }
}
