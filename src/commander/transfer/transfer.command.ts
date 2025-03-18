import { encodeFunctionData, getAddress, Hex, erc20Abi } from 'viem'
import { Command, CommandRunner, Option } from 'nest-commander'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'

@Command({
  name: 'transfer',
  arguments: '<recipient>',
  description:
    'Moves ERC20 tokens from the Kernel wallet to another address, all values are in decimal 6 format',
})
export class TransferCommand extends CommandRunner {
  constructor(private readonly kernelAccountClientService: KernelAccountClientService) {
    super()
  }

  async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
    console.log('CLI TransferCommand Params', passedParams)
    const recipient = getAddress(passedParams[0])
    console.log('Recipient', recipient)
    if (options?.token && options?.amount && options?.chainID) {
      console.log(
        `Transfering token: ${options.token} to ${recipient} with amount: ${options.amount}`,
      )
      this.transferToken(options.chainID, options.token, recipient, options.amount)
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
    console.log('Transfer Request', receipt)
  }
}
