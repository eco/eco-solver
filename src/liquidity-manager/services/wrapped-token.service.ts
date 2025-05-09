import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { erc20Abi, formatUnits, getAddress, Hex, parseUnits } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { BalanceService } from '@/balance/balance.service'
import { TokenConfig } from '@/balance/types'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { TokenData, RebalanceQuote, RebalanceRequest } from '@/liquidity-manager/types/types'

/**
 * Service responsible for managing wrapped token operations like WETH
 * This service abstracts chain-specific wrapped token logic from the
 * main liquidity manager service.
 */
@Injectable()
export class WrappedTokenService {
  private logger = new Logger(WrappedTokenService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly liquidityProviderManager: LiquidityProviderService,
  ) {}

  /**
   * Gets rebalance requests for all supported wrapped tokens across all chains
   * @param walletAddress The address to check for wrapped token balances
   * @returns Array of rebalance requests for wrapped tokens
   */
  async getWrappedTokenRebalances(walletAddress: Hex): Promise<RebalanceRequest[]> {
    try {
      // First check if this is a kernel address - we only rebalance for kernel wallets
      const opChainId = 10 // Use OP as the default chain
      const client = await this.kernelAccountClientService.getClient(opChainId)
      const kernelAddress = client.kernelAccount.address

      if (kernelAddress !== walletAddress) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Skipping wrapped token rebalance for non-kernel wallet',
            properties: {
              walletAddress,
              kernelAddress,
            },
          }),
        )
        return []
      }

      // Get tokens by chain for this wallet
      const tokensPerWallet = this.balanceService.getInboxTokens()
      
      // Group tokens by chainId
      const tokensByChain: Record<string, TokenConfig[]> = tokensPerWallet.reduce((result, token) => {
        const key = String(token.chainId);
        (result[key] = result[key] || []).push(token);
        return result;
      }, {} as Record<string, TokenConfig[]>);
      
      const chainIDs = Object.keys(tokensByChain)

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Checking wrapped token balances across chains',
          properties: {
            walletAddress,
            chainCount: chainIDs.length,
            chains: chainIDs,
          },
        }),
      )

      // Process all WETH rebalances in parallel
      const wethRequests = await Promise.all(
        Array.from(chainIDs).map(async (chainID) => {
          try {
            const targetToken = tokensByChain[chainID][0]
            return await this.getWETHRebalance(walletAddress, Number(chainID), targetToken)
          } catch (error) {
            this.logger.error(
              EcoLogMessage.fromDefault({
                message: 'Error processing WETH rebalance for chain',
                properties: {
                  chainId: chainID,
                  walletAddress,
                  error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
                },
              }),
            )
            return undefined
          }
        }),
      )

      // Filter out undefined results
      const validRequests = wethRequests.filter(Boolean) as RebalanceRequest[]

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Wrapped token rebalance summary',
          properties: {
            totalRebalances: validRequests.length,
            chains: validRequests.map(req => req.token.chainId),
          },
        }),
      )

      return validRequests
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Unexpected error getting wrapped token rebalances',
          properties: {
            walletAddress,
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          },
        }),
      )
      return []
    }
  }

  /**
   * Gets a rebalance request for WETH tokens on a specific chain if the balance exceeds threshold
   * @param walletAddress Address of the wallet to check
   * @param chainId Chain ID to check for WETH balance
   * @param token Token to convert WETH into
   * @returns Rebalance request or undefined if not needed
   */
  private async getWETHRebalance(
    walletAddress: Hex,
    chainId: number,
    token: TokenConfig,
  ): Promise<RebalanceRequest | undefined> {
    try {
      // Get WETH configuration
      const wethConfig = this.ecoConfigService.getWETH()
      
      if (!wethConfig) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'WETH configuration not found',
            properties: {
              chainId,
              walletAddress,
            },
          }),
        )
        return
      }
      
      const { addresses, threshold } = wethConfig
      
      // Validate addresses is an object
      if (!addresses || typeof addresses !== 'object') {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'WETH addresses configuration is invalid',
            properties: {
              addresses,
              chainId,
            },
          }),
        )
        return
      }
      
      const wethAddr = addresses[chainId]
      
      // Skip if no WETH address is configured for this chain
      if (!wethAddr) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'No WETH address configured for this chain',
            properties: {
              chainId,
              walletAddress,
              configuredChains: Object.keys(addresses),
            },
          }),
        )
        return
      }
      
      // Try to checksum the address
      let checksummedAddr: Hex
      try {
        checksummedAddr = getAddress(wethAddr) as Hex
      } catch (error) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'Invalid WETH address format',
            properties: {
              chainId,
              wethAddr,
              error: error instanceof Error ? error.message : error,
            },
          }),
        )
        return
      }
      
      // Validate threshold
      if (!threshold || parseFloat(threshold) <= 0) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'Invalid WETH threshold configuration',
            properties: {
              threshold,
              chainId,
            },
          }),
        )
        return
      }
      
      // Get client and set maximum balance
      const client = await this.kernelAccountClientService.getClient(chainId)
      const maximumBalance = parseUnits(threshold, 18)

      // Read WETH balance and decimals together using a multicall
      let wethBalance: bigint
      let wethDecimals: number = 18 // Default to 18, but we'll try to read it
      
      try {
        // Use multicall to batch the contract calls
        const [balanceResult, decimalsResult] = await client.multicall({
          contracts: [
            {
              abi: erc20Abi,
              address: checksummedAddr,
              functionName: 'balanceOf',
              args: [walletAddress],
            },
            {
              abi: erc20Abi,
              address: checksummedAddr,
              functionName: 'decimals',
            }
          ],
        })
        
        // Handle the results
        if (balanceResult.status !== 'success') {
          throw new Error(`Failed to read WETH balance: ${balanceResult.error?.message || 'Unknown error'}`)
        }
        
        wethBalance = balanceResult.result
        
        // If decimals call succeeded, use that value
        if (decimalsResult.status === 'success') {
          wethDecimals = Number(decimalsResult.result)
        } else {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: 'Failed to read WETH decimals, using default of 18',
              properties: {
                chainId,
                wethAddr,
                error: decimalsResult.error?.message,
              },
            }),
          )
        }
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: 'Failed to read WETH balance and decimals',
            properties: {
              chainId,
              wethAddr: checksummedAddr,
              walletAddress,
              error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            },
          }),
        )
        return
      }

      // Skip if balance is below threshold
      if (wethBalance < maximumBalance) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'WETH balance below threshold',
            properties: {
              chainId,
              wethAddr: checksummedAddr,
              walletAddress,
              balance: formatUnits(wethBalance, wethDecimals),
              threshold,
              decimals: wethDecimals,
            },
          }),
        )
        return
      }

      const amount = Number.parseFloat(formatUnits(wethBalance, wethDecimals))

      // Create WETH token data
      const WETHToken: TokenData = {
        chainId,
        config: { address: checksummedAddr, chainId, type: 'erc20', targetBalance: 0, minBalance: 0 },
        balance: { balance: wethBalance, address: checksummedAddr, decimals: wethDecimals },
      }

      // Get token out data
      let tokenOut: TokenData
      try {
        [tokenOut] = await this.balanceService.getAllTokenDataForAddress(walletAddress, [token])
        if (!tokenOut) {
          throw new Error('Target token data not found')
        }
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: 'Failed to get token data for rebalance',
            properties: {
              chainId,
              token,
              walletAddress,
              error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            },
          }),
        )
        return
      }

      // Get quotes for the rebalance
      let quotes: RebalanceQuote[]
      try {
        quotes = await this.liquidityProviderManager.getQuote(
          walletAddress,
          WETHToken,
          tokenOut,
          amount,
        )
        
        if (!quotes.length) {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: 'No quotes available for WETH rebalance',
              properties: {
                chainId,
                wethAddr,
                tokenOutAddr: tokenOut.config.address,
                amount,
              },
            }),
          )
          return
        }
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: 'Failed to get quotes for WETH rebalance',
            properties: {
              chainId,
              wethAddr,
              tokenOutAddr: tokenOut.config.address,
              amount,
              error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
            },
          }),
        )
        return
      }

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'WETH rebalance requested',
          properties: {
            chainId,
            wethAddr: checksummedAddr,
            balance: formatUnits(wethBalance, wethDecimals),
            threshold,
            decimals: wethDecimals,
            quotesCount: quotes.length,
          },
        }),
      )

      return { token: WETHToken, quotes }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Unexpected error in getWETHRebalance',
          properties: {
            chainId,
            walletAddress,
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          },
        }),
      )
      return
    }
  }
}