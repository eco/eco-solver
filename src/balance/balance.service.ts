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
import { ChainAddress, getVMType, VMType } from '@/eco-configs/eco-config.types'
import { EvmBalanceService } from './services/evm-balance.service'
import { SvmBalanceService } from './services/svm-balance.service'

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
    tokenAddresses: ChainAddress[],
  ): Promise<Record<ChainAddress, TokenBalance>> {
    const vmType = getVMType(chainID)
    
    switch (vmType) {
      case VMType.EVM:
        return this.evmBalanceService.fetchTokenBalances(chainID, tokenAddresses)
      case VMType.SVM:
        return this.svmBalanceService.fetchTokenBalances(chainID, tokenAddresses)
      default:
        throw EcoError.UnsupportedChainError({ id: chainID, name: 'Unknown' } as Chain)
    }
  }

  /**
   * Fetches the token balances of a wallet for the given token list.
   * @param chainID the chain id
   * @param walletAddress wallet address
   * @param tokenAddresses the tokens to fetch balances for
   * @returns
   */
  async fetchWalletTokenBalances(
    chainID: number,
    walletAddress: string,
    tokenAddresses: string[],
  ): Promise<Record<string, TokenBalance>> {
    const vmType = getVMType(chainID)
    
    switch (vmType) {
      case VMType.EVM:
        return this.evmBalanceService.fetchWalletTokenBalances(chainID, walletAddress, tokenAddresses)
      case VMType.SVM:
        return this.svmBalanceService.fetchWalletTokenBalances(chainID, walletAddress, tokenAddresses)
      default:
        throw EcoError.UnsupportedChainError({ id: chainID, name: 'Unknown' } as Chain)
    }
  }

  @Cacheable()
  async fetchTokenBalance(chainID: number, tokenAddress: ChainAddress): Promise<TokenBalance> {
    const result = await this.fetchTokenBalances(chainID, [tokenAddress])
    return result[tokenAddress]
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
   * @param account - The account type to check ('kernel' or 'eoc')
   * @returns The native token balance in base units (wei for EVM, lamports for SVM), or 0n if no address is found
   */
  @Cacheable()
  async getNativeBalance(chainID: number, account: 'kernel' | 'eoc'): Promise<bigint> {
    const vmType = getVMType(chainID)
    
    switch (vmType) {
      case VMType.EVM:
        return this.evmBalanceService.getNativeBalance(chainID, account)
      case VMType.SVM:
        return this.svmBalanceService.getNativeBalance(chainID, account)
      default:
        throw EcoError.UnsupportedChainError({ id: chainID, name: 'Unknown' } as Chain)
    }
  }

  async getAllTokenDataForAddress(walletAddress: string, tokens: TokenConfig[]) {
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
    tokenAddress: ChainAddress,
  ): Promise<TokenBalance | undefined> {
    const key = getDestinationNetworkAddressKey(chainID, tokenAddress)
    if (!this.tokenBalances.has(key)) {
      const tokenBalance = await this.fetchTokenBalance(chainID, tokenAddress)
      this.tokenBalances.set(key, tokenBalance)
    }
    return this.tokenBalances.get(key)
  }
}
