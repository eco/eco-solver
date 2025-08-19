import { Inject, Injectable, Logger } from '@nestjs/common'
import { Hex, isAddressEqual, pad, parseUnits, toHex, keccak256 } from 'viem'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
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

@Injectable()
export class GatewayProviderService implements IRebalanceProvider<'Gateway'> {
  private logger = new Logger(GatewayProviderService.name)
  private client: GatewayHttpClient
  // cacheManager and configService are required by @Cacheable decorator
  private liquidityManagerQueue: LiquidityManagerQueue

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

    const amount = BigInt(bootstrap.amountBase6)
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
    swapAmount: number,
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

    // Build amounts in token-native decimals and base-6 for Gateway context
    const amountBase6 = parseUnits(String(swapAmount), 6)
    const amountIn = parseUnits(String(swapAmount), tokenIn.balance.decimals)
    const amountOut = parseUnits(String(swapAmount), tokenOut.balance.decimals)

    if (tokenIn.balance.decimals !== 6 || tokenOut.balance.decimals !== 6) {
      this.logger.warn(
        EcoLogMessage.withId({
          message: 'Gateway: USDC token decimals are not 6 — check token configuration',
          id,
          properties: {
            inDecimals: tokenIn.balance.decimals,
            outDecimals: tokenOut.balance.decimals,
            tokenIn: tokenIn.config.address,
            tokenOut: tokenOut.config.address,
          },
        }),
      )
    }

    // Validate chain support using Gateway info
    await this.ensureDomainsSupported(inChain.domain, outChain.domain, id)

    // Ensure sufficient unified balance at Gateway for the depositor (EOA)
    await this.ensureSufficientUnifiedBalance(inChain.domain, amountBase6)

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Gateway: building zero-slippage quote',
        id,
        properties: {
          sourceDomain: inChain.domain,
          destinationDomain: outChain.domain,
          amountBase6: amountBase6.toString(),
        },
      }),
    )

    const quote: RebalanceQuote<'Gateway'> = {
      amountIn: amountIn,
      amountOut: amountOut,
      slippage: 0,
      tokenIn,
      tokenOut,
      strategy: 'Gateway',
      context: {
        sourceDomain: inChain.domain,
        destinationDomain: outChain.domain,
        amountBase6,
        id,
      },
      id,
    }

    return quote
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'Gateway'>): Promise<string> {
    const { sourceDomain, destinationDomain, amountBase6, id } = quote.context

    // Resolve addresses per Option A
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
    await this.ensureSufficientUnifiedBalance(sourceDomain, amountBase6)

    // 1) Build EIP-712 burn-intent typed data locally (encode endpoint not available)
    const sourceWallet = await this.getWalletAddress(sourceDomain)
    const destinationMinter = await this.getMinterAddress(destinationDomain)
    const typedData = this.buildBurnIntentTypedData({
      sourceDomain,
      destinationDomain,
      sourceContract: sourceWallet,
      destinationContract: destinationMinter,
      sourceToken: inChainCfg.usdc,
      destinationToken: outChainCfg.usdc,
      sourceDepositor: eoaAddress,
      destinationRecipient: kernelAddress,
      sourceSigner: eoaAddress,
      destinationCaller: '0x0000000000000000000000000000000000000000' as Hex,
      value: amountBase6,
      // Basic salt to ensure uniqueness; can be improved later
      salt: keccak256(
        toHex(`${Date.now()}-${id ?? ''}-${eoaAddress}-${amountBase6.toString()}`),
      ) as Hex,
      hookData: '0x',
      // Conservative defaults if encode is unavailable
      maxBlockHeight: BigInt(10_000_000_000),
      maxFee: 0n,
    })

    // 2) Sign the EIP-712 intent
    const signerClient = await this.walletClientService.getClient(quote.tokenIn.chainId)
    const signature: Hex = await (signerClient as any).signTypedData(typedData)

    // 3) Request attestation from Gateway API
    const attestationResp = await this.client.createTransferAttestation({
      burnIntents: [
        {
          intent: typedData as any,
          signer: eoaAddress,
          signature,
        },
      ],
    })
    if ('message' in attestationResp) {
      throw new Error(`Gateway attestation error: ${attestationResp.message}`)
    }

    // 3) Mint on destination
    const minterAddress = await this.getMinterAddress(destinationDomain)
    const destWalletClient = await this.walletClientService.getClient(quote.tokenOut.chainId)
    const destPublicClient = await this.walletClientService.getPublicClient(quote.tokenOut.chainId)

    const txHash = await destWalletClient.writeContract({
      abi: (await import('./constants/abis')).gatewayMinterAbi,
      address: minterAddress,
      functionName: 'gatewayMint',
      args: [attestationResp.attestation, attestationResp.signature],
    })
    await destPublicClient.waitForTransactionReceipt({ hash: txHash })

    this.logger.log(
      EcoLogMessage.withId({
        message: 'Gateway: Minted on destination',
        id,
        properties: { txHash, destinationDomain, depositor: eoaAddress, recipient: kernelAddress },
      }),
    )

    // Enqueue top-up of unified balance from Kernel via depositFor to EOA
    const inChainTopUp = this.configService
      .getGatewayConfig()
      .chains.find((c) => c.chainId === quote.tokenIn.chainId)
    const gatewayInfo = await this.getSupportedDomains(false)
    const walletAddr =
      (inChainTopUp?.['wallet'] as Hex | undefined) ||
      (gatewayInfo.find((d) => d.domain === sourceDomain)?.wallet as Hex | undefined)

    if (inChainTopUp?.usdc && walletAddr) {
      await this.liquidityManagerQueue.startGatewayTopUp({
        chainId: quote.tokenIn.chainId,
        usdc: inChainTopUp.usdc,
        gatewayWallet: walletAddr,
        amount: serialize(quote.amountIn),
        depositor: eoaAddress,
        id,
      })
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

  // Formats a base-6 bigint amount into a decimal string with 6 decimals, without scientific notation
  private formatDecimal(amountBase6: bigint, decimals: number): string {
    const s = amountBase6.toString()
    const padLen = Math.max(0, decimals - s.length)
    const whole = s.length > decimals ? s.slice(0, -decimals) : '0'
    const frac = (padLen ? '0'.repeat(padLen) : '') + s.slice(Math.max(0, s.length - decimals))
    const trimmedFrac = frac.replace(/0+$/, '')
    return trimmedFrac.length ? `${whole}.${trimmedFrac}` : whole
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

  private async ensureSufficientUnifiedBalance(domain: number, requiredBase6: bigint) {
    const depositor = (await this.walletClientService.getAccount()).address as Hex
    const balanceResp = await this.client.getBalances({
      token: 'USDC',
      sources: [{ depositor, domain }],
    })
    const srcBalance = balanceResp.balances.find((b) => b.domain === domain)?.balance || '0'
    const availableBase6 = parseUnits(srcBalance, 6)
    if (availableBase6 < requiredBase6) {
      throw new GatewayQuoteValidationError('Insufficient Gateway unified balance', {
        requestedBase6: requiredBase6.toString(),
        availableBase6: availableBase6.toString(),
        domain,
        depositor,
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
