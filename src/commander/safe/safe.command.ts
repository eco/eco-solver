import { getAddress } from 'viem'
import { Command, CommandRunner, Option } from 'nest-commander'
import { getExecutorTransferData } from '@/transaction/smart-wallets/kernel/create.kernel.account'
import { GLOBAL_CONSTANTS } from '@rhinestone/module-sdk'

@Command({
  name: 'safe',
  description:
    'Generates the transaction calldata for a safe transaction on the OwnableExecutor module',
})
export class SafeCommand extends CommandRunner {
  constructor() {
    super()
  }

  async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
    if (options?.to && options?.amount && options?.token && options?.kernel) {
      console.log(
        `Transfer:
        amount: ${options.amount}
        token ${options.token}
        to ${options.to}
        kernel ${options.kernel}`,
      )
      const data = getExecutorTransferData(options?.kernel, {
        to: options.to,
        amount: options.amount,
        tokenAddress: options.token,
      })
      console.log(`OwnableExecutor transfer data: ${data}`)
      console.log(`Should execute data on OwnableExecutor contract: ${GLOBAL_CONSTANTS.OWNABLE_EXECUTOR_ADDRESS}`)
      return
    }
    console.log('You must set the to, amount, token and kernelAddress to generate the calldata')
  }

  @Option({
    flags: '-k, --kernel <kernel>',
    description: 'The kernel wallet address for the executor to call, which it owns',
  })
  parseKernelAddress(val: string) {
    return getAddress(val)
  }

  @Option({
    flags: '-t, --to <to>',
    description: 'The recipient of the transaction',
  })
  parseTo(val: string) {
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
    flags: '-tk, --token <token>',
    description: 'The ERC20 token address to transfer',
  })
  parseToken(val: string) {
    return getAddress(val)
  }
}
