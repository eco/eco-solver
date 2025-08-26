import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy, zipWith } from 'lodash'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { getDestinationNetworkAddressKey } from '@/common/utils/strings'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Chain, Hex } from 'viem'
import { ViemEventLog } from '@/common/events/viem'
import { decodeTransferLog, isSupportedTokenType } from '@/contracts'
import { TokenBalance, TokenConfig } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cacheable } from '@/decorators/cacheable.decorator'
import { getVmType, VmType } from '@/eco-configs/eco-config.types'
import { Address, SerializableAddress } from '@/eco-configs/eco-config.types'
import { EvmBalanceService } from './services/evm-balance.service'
import { SvmBalanceService } from './services/svm-balance.service'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'

/**
 * Composite data from fetching the token balances for a chain
 */
export type TokenFetchAnalysis = {
  config: TokenConfig
  token: TokenBalance
  chainId: number
}

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class BalanceService implements OnApplicationBootstrap {
  private logger = new Logger(BalanceService.name)

  private readonly tokenBalances: Map<string, TokenBalance> = new Map()

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: EcoConfigService,
    private readonly evmBalanceService: EvmBalanceService,
    private readonly svmBalanceService: SvmBalanceService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  async onApplicationBootstrap() {
    // iterate over all tokens
    await Promise.all(this.getInboxTokens().map((token) => this.loadTokenBalance(token)))
  }

  /**
   * Updates the token balance of the solver, called from {@link EthWebsocketProcessor}
   * @returns
   */
  updateBalance(balanceEvent: ViemEventLog) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `updateBalance ${balanceEvent.transactionHash}`,
        properties: {
          intentHash: balanceEvent.transactionHash,
        },
      }),
    )

    const intent = decodeTransferLog(balanceEvent.data, balanceEvent.topics)
    const key = getDestinationNetworkAddressKey(balanceEvent.sourceChainID, balanceEvent.address)
    const balanceObj = this.tokenBalances.get(key)
    if (balanceObj) {
      balanceObj.balance = balanceObj.balance + intent.args.value
    }
  }

  /**
   * Updates the Solana balance based on account notifications
   * @param solanaEvent - Event containing account info and chain details
   */
  updateSolanaBalance(solanaEvent: any) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `updateSolanaBalance`,
        properties: {
          chainID: solanaEvent.sourceChainID,
          timestamp: solanaEvent.timestamp,
        },
      }),
    )

    // For Solana, we track the SOL balance (lamports) from account notifications
    // The account info contains the current lamports balance
    if (solanaEvent.accountInfo?.value?.lamports) {
      const lamports = BigInt(solanaEvent.accountInfo.value.lamports)
      
      // Use a special key for SOL balance tracking
      const key = getDestinationNetworkAddressKey(
        parseInt(solanaEvent.sourceChainID), 
        'SOL' // Special identifier for native SOL
      )
      
      const balanceObj = this.tokenBalances.get(key)
      if (balanceObj) {
        // Update to the current balance (not additive like ERC20 transfers)
        balanceObj.balance = lamports
        
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `Solana balance updated`,
            properties: {
              key,
              newBalance: lamports.toString(),
            },
          }),
        )
      }
    }
  }

  /**
   * Gets the tokens that are in the solver wallets
   * @returns List of tokens that are supported by the solver
   */
  getInboxTokens(): TokenConfig[] {
    return Object.values(this.configService.getSolvers()).flatMap((solver) => {
      return Object.entries(solver.targets)
        .filter(([, targetContract]) => isSupportedTokenType(targetContract.contractType))
        .map(([tokenAddress, targetContract]) => ({
          address: tokenAddress as Hex,
          chainId: solver.chainID,
          type: targetContract.contractType,
          minBalance: targetContract.minBalance,
          targetBalance: targetContract.targetBalance,
        }))
    })
  }

  /**
   * Fetches the balances of the solver's wallet for the given tokens
   * @param chainID the chain id
   * @param tokenAddresses the tokens to fetch balances for
   * @returns
   */
  @Cacheable()
  async fetchTokenBalances(
    chainID: number,
     tokenAddresses: Address[],
  ): Promise<Record<SerializableAddress, TokenBalance>> {
    const startTime = Date.now()
    const vmType = getVmType(chainID)

    try {
      switch (vmType) {
        case VmType.EVM: {
          const evmAddresses = tokenAddresses as Address<VmType.EVM>[]
          return await this.evmBalanceService.fetchTokenBalances(chainID, evmAddresses)
        }
        case VmType.SVM: {
          const svmAddresses = tokenAddresses as Address<VmType.SVM>[]
          return await this.svmBalanceService.fetchTokenBalances(chainID, svmAddresses)
        }
        default:
          throw EcoError.UnsupportedChainError({ id: chainID, name: 'Unknown' } as Chain)
      }
    } catch (error) {
      // Track balance fetch error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BALANCE.FETCH_FAILED, error, {
        chainID,
        tokenCount: tokenAddresses.length,
        processingTimeMs: Date.now() - startTime,
      })
      throw error
    }

    try {
      const client = await this.kernelAccountClientService.getClient(chainID)
      const walletAddress = client.kernelAccount.address
      const result = await this.fetchWalletTokenBalances(chainID, walletAddress, tokenAddresses)

      // Track successful balance fetch
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.BALANCE.FETCH_SUCCESS, {
        chainID,
        walletAddress,
        tokenCount: tokenAddresses.length,
        processingTimeMs: Date.now() - startTime,
      })

      return result
    } catch (error) {
      // Track balance fetch error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BALANCE.FETCH_FAILED, error, {
        chainID,
        tokenCount: tokenAddresses.length,
        processingTimeMs: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Fetches the token balances of a wallet for the given token list.
   * @param chainID the chain id
   * @param walletAddress wallet address
   * @param tokenAddresses the tokens to fetch balances for
   * @param cache Flag to enable or disable caching
   * @returns
   */
  @Cacheable({ bypassArgIndex: 3 })
  async fetchWalletTokenBalances(
    chainID: number,
    walletAddress: Address,
    tokenAddresses: Address[],
  ): Promise<Record<SerializableAddress, TokenBalance>> {
    const vmType = getVmType(chainID)
    
    switch (vmType) {
      case VmType.EVM: {
        const evmWallet = walletAddress as Address<VmType.EVM>
        const evmAddresses = tokenAddresses as Address<VmType.EVM>[]
        return await this.evmBalanceService.fetchWalletTokenBalances(chainID, evmWallet, evmAddresses)
      }
      case VmType.SVM: {
        const svmWallet = walletAddress as Address<VmType.SVM>
        const svmAddresses = tokenAddresses as Address<VmType.SVM>[]
        return await this.svmBalanceService.fetchWalletTokenBalances(chainID, svmWallet, svmAddresses)
      }
      default:
        throw EcoError.UnsupportedChainError({ id: chainID, name: 'Unknown' } as Chain)
    }
  }

  @Cacheable()
  async fetchTokenBalance(chainID: number, tokenAddress: Address): Promise<TokenBalance> {
    const result = await this.fetchTokenBalances(chainID, [tokenAddress])
    return result[tokenAddress.toString()]
  }

  @Cacheable()
  async fetchTokenBalancesForChain(
    chainID: number,
  ): Promise<Record<Hex, TokenBalance> | undefined> {
    const intentSource = this.configService.getIntentSource(chainID)
    if (!intentSource) {
      return undefined
    }
    return this.fetchTokenBalances(chainID, intentSource.tokens)
  }

  @Cacheable()
  async fetchTokenData(chainID: number): Promise<TokenFetchAnalysis[]> {
    const tokenConfigs = groupBy(this.getInboxTokens(), 'chainId')[chainID]
    const tokenAddresses = tokenConfigs.map((token) => token.address)
    const tokenBalances = await this.fetchTokenBalances(chainID, tokenAddresses)
    return zipWith(tokenConfigs, Object.values(tokenBalances), (config, token) => ({
      config,
      token,
      chainId: chainID,
    }))
  }

  @Cacheable()
  async getAllTokenData() {
    const tokens = this.getInboxTokens()
    const tokensByChainId = groupBy(tokens, 'chainId')
    const chainIds = Object.keys(tokensByChainId)

    const balancesPerChainIdPromise = chainIds.map(async (chainId) => {
      const configs = tokensByChainId[chainId]
      const tokenAddresses = configs.map((token) => token.address)
      const balances = await this.fetchTokenBalances(parseInt(chainId), tokenAddresses)
      return zipWith(configs, Object.values(balances), (config, balance) => ({
        config,
        balance,
        chainId: parseInt(chainId),
      }))
    })

    return Promise.all(balancesPerChainIdPromise).then((result) => result.flat())
  }

  /**
   * Gets the native token balance (ETH, MATIC, SOL, etc.) for the solver's wallet on the specified chain.
   * This is used to check if the solver has sufficient native funds to cover gas costs and native value transfers.
   *
   * @param chainID - The chain ID to check the native balance on
   * @param address
   * @returns The native token balance in wei (base units), or 0n if no EOA address is found
   */
  @Cacheable()
  async getNativeBalance(chainID: number, address: Hex): Promise<bigint> {
    const vmType = getVmType(chainID)
    
    switch (vmType) {
      case VmType.EVM:
        const client = await this.kernelAccountClientService.getClient(chainID)
        return this.evmBalanceService.getNativeBalance(chainID, address)
      case VmType.SVM:
        return this.svmBalanceService.getNativeBalance(chainID, address)
      default:
        throw EcoError.UnsupportedChainError({ id: chainID, name: 'Unknown' } as Chain)
    }

    
  }

  async getAllTokenDataForAddress(walletAddress: Address, tokens: TokenConfig[]) {
    const tokensByChainId = groupBy(tokens, 'chainId')
    const chainIds = Object.keys(tokensByChainId)

    const balancesPerChainIdPromise = chainIds.map(async (chainId) => {
      const configs = tokensByChainId[chainId]
      const tokenAddresses = configs.map((token) => token.address)
      const balances = await this.fetchWalletTokenBalances(
        parseInt(chainId),
        walletAddress,
        tokenAddresses,
      )
      return zipWith(configs, Object.values(balances), (config, balance) => ({
        config,
        balance,
        chainId: parseInt(chainId),
      }))
    })

    return Promise.all(balancesPerChainIdPromise).then((result) => result.flat())
  }

  /**
   * Loads the token balance of the solver
   * @returns
   */
  private async loadTokenBalance(token: TokenConfig) {
    switch (token.type) {
      case 'erc20':
        return this.loadERC20TokenBalance(token.chainId, token.address)
      default:
        throw EcoError.IntentSourceUnsupportedTargetType(token.type)
    }
  }

  private async loadERC20TokenBalance(
    chainID: number,
    tokenAddress: Address,
  ): Promise<TokenBalance | undefined> {
    const key = getDestinationNetworkAddressKey(chainID, tokenAddress.toString())
    if (!this.tokenBalances.has(key)) {
      const tokenBalance = await this.fetchTokenBalance(chainID, tokenAddress)
      this.tokenBalances.set(key, tokenBalance)
    }
    return this.tokenBalances.get(key)
  }
}
