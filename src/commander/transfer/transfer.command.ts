import { encodeFunctionData, getAddress, Hex, erc20Abi, parseEther } from 'viem'
import { Command, CommandRunner, Option } from 'nest-commander'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { BalanceService } from '@/balance/balance.service'

@Command({
  name: 'transfer',
  arguments: '<recipient>',
  description:
    'Moves ERC20 tokens from the Kernel wallet to another address, all values are in decimal 6 format',
})
export class TransferCommand extends CommandRunner {
  constructor(
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly balanceService: BalanceService,
  ) {
    super()
  }

  async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
    console.log('CLI TransferCommand Params', passedParams)
    const recipient = getAddress(passedParams[0])
    console.log('Recipient', recipient)

    if (options?.native && options?.chainID) {
      console.log(`Transfering native tokens to ${recipient} with amount: ${options.native}`)
      await this.transferNative(options.chainID, recipient, options.native)
      return
    }

    if (options?.everything && options?.chainID) {
      console.log(`Transfering all tokens to ${recipient}`)
      await this.transferTokens(options.chainID, recipient)
      return
    }

    if (options?.token && options?.amount && options?.chainID) {
      console.log(
        `Transfering token: ${options.token} to ${recipient} with amount: ${options.amount}`,
      )
      await this.transferToken(options.chainID, options.token, recipient, options.amount)
      return
    }
  }

  @Option({
    flags: '-t, --token <token>',
    description: 'The address of the token to transfer',
  })
  parseToken(val: string) {
    return getAddress(val)
  }

  @Option({
    flags: '-a, --amount <amount>',
    description: 'The amount in the decimals of the token to transfer',
  })
  parseAmount(val: string) {
    return BigInt(val)
  }

  @Option({
    flags: '-c, --chainID <chainID>',
    description: 'The chain ID for a token balance',
  })
  parseChainID(val: string) {
    return Number(val)
  }

  @Option({
    flags: '-e, --everything',
    description: 'True if the transfer should be done for all tokens',
  })
  parseEverything(val: string) {
    console.log('parseEverything', val)
    return true
  }

  @Option({
    flags: '-n, --native <native>',
    description: 'The amount of native tokens to send, in normal eth format',
  })
  parseNative(val: string) {
    console.log('parseNative', val)
    return parseEther(val)
  }

  /**
   * Transfers a token to a recipient
   * @param chainID the chain id
   * @param token the token address
   * @param recipient the recipient address
   * @param amount the amount to transfer, assumes in correct decimal format for that token
   */
  async transferToken(chainID: number, token: Hex, recipient: Hex, amount: bigint) {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const transferFunctionData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amount],
    })
    const receipt = await client.execute([
      { to: token, data: transferFunctionData, value: BigInt(0) },
    ])
    console.log('Transfer Receipt', receipt)
    await client.waitForTransactionReceipt({ hash: receipt, confirmations: 5 })
  }

  /**
   * Sends all the tokens on a given chain to a recipient
   * @param chainID the chain id
   * @param recipient the recipient address
   * @returns
   */
  async transferTokens(chainID: number, recipient: Hex) {
    const tokens = await this.balanceService.fetchTokenBalancesForChain(chainID)
    if (!tokens) {
      console.log('No tokens found')
      return
    }
    const filtered = Object.values(tokens).filter((token) => token.balance > BigInt(0))
    for (const token of filtered) {
      await this.transferToken(chainID, token.address, recipient, token.balance)
    }
  }

  /**
   * Transfers native tokens to a recipient
   * @param chainID the chain id
   * @param recipient the recipient address
   * @param amount the amount to transfer in wei format
   */
  async transferNative(chainID: number, recipient: Hex, amount: bigint) {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const receipt = await client.execute([{ to: recipient, value: amount }])
    console.log('Transfer Receipt', receipt)
  }
}
