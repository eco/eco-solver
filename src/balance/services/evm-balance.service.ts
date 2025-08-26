import { Injectable, Logger } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { erc20Abi, Hex, MulticallParameters, MulticallReturnType } from 'viem'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { TokenBalance } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'
import { BalanceProvider } from '../interfaces/balance-provider.interface'
import { Address, SerializableAddress, VmType } from '@/eco-configs/eco-config.types'

@Injectable()
export class EvmBalanceService implements BalanceProvider {
  private logger = new Logger(EvmBalanceService.name)

  constructor(
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  /**
   * Fetches the balances of the kernel account client of the solver for the given tokens
   * @param chainID the chain id
   * @param tokenAddresses the tokens to fetch balances for
   * @returns
   */
  async fetchTokenBalances(
    chainID: number,
    tokenAddresses: Address<VmType.EVM>[],
  ): Promise<Record<SerializableAddress<VmType.EVM>, TokenBalance>> {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const walletAddress = client.kernelAccount.address
    return this.fetchWalletTokenBalances(chainID, walletAddress, tokenAddresses)
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
    walletAddress: Address<VmType.EVM>,
    tokenAddresses: Address<VmType.EVM>[],
  ): Promise<Record<SerializableAddress<VmType.EVM>, TokenBalance>> {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const hexTokenAddresses = tokenAddresses as Hex[]

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `fetchWalletTokenBalances (EVM)`,
        properties: {
          chainID,
          tokenAddresses,
          walletAddress,
        },
      }),
    )

    const results = (await client.multicall({
      contracts: hexTokenAddresses.flatMap((tokenAddress): MulticallParameters['contracts'] => [
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'balanceOf',
          args: [walletAddress],
        },
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'decimals',
        },
      ]),
      allowFailure: false,
    })) as MulticallReturnType

    const tokenBalances: Record<string, TokenBalance> = {}

    hexTokenAddresses.forEach((tokenAddress, index) => {
      const [balance = 0n, decimals = 0] = [results[index * 2], results[index * 2 + 1]]
      //throw if we suddenly start supporting tokens with not 6 decimals
      //audit conversion of validity to see its support
      if ((decimals as number) != 6) {
        throw EcoError.BalanceServiceInvalidDecimals(tokenAddress)
      }
      tokenBalances[tokenAddress] = {
        address: tokenAddress,
        balance: balance as bigint,
        decimals: decimals as number,
      }
    })
    return tokenBalances
  }

  /**
   * Gets the native token balance (ETH, MATIC, etc.) for the solver's EOA wallet on the specified chain.
   * This is used to check if the solver has sufficient native funds to cover gas costs and native value transfers.
   *
   * @param chainID - The chain ID to check the native balance on
   * @returns The native token balance in wei (base units), or 0n if no EOA address is found
   */
  async getNativeBalance(chainID: number, address: Address<VmType.EVM>): Promise<bigint> {
    const client = await this.kernelAccountClientService.getClient(chainID)
    if (!address) {
      return 0n
    }
    return await client.getBalance({ address })
  }
}