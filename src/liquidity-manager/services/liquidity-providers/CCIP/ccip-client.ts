/**
 * Minimal CCIP helper derived from the MIT-licensed @chainlink/ccip-js package.
 * Reimplemented locally so we can run in CommonJS/Jest environments.
 */
import {
  Address,
  Chain,
  Hex,
  PublicClient,
  encodeAbiParameters,
  isAddress,
  isAddressEqual,
  isHash,
  zeroAddress,
  zeroHash,
} from 'viem'
import { getBlockNumber, getLogs, readContract } from 'viem/actions'
import {
  EXECUTION_STATE_CHANGED_EVENT,
  ROUTER_ABI,
  TRANSFER_STATUS_FROM_BLOCK_SHIFT,
} from './ccip-abis'

type FeeOptions = {
  client: PublicClient
  routerAddress: Address
  destinationAccount: Address
  destinationChainSelector: string
  tokenAddress?: Address
  amount?: bigint
  feeTokenAddress?: Address
  data?: Hex
  extraArgs?: {
    gasLimit?: bigint | number
    allowOutOfOrderExecution?: boolean
  }
}

type OnRampOptions = {
  client: PublicClient
  routerAddress: Address
  destinationChainSelector: string
}

type TransferStatusOptions = {
  client: PublicClient
  destinationRouterAddress: Address
  sourceChainSelector: string
  messageId: Hex
  fromBlockNumber?: bigint
}

export enum TransferStatus {
  Untouched = 0,
  InProgress = 1,
  Success = 2,
  Failure = 3,
}

export const createClient = () => ({
  getFee: (options: FeeOptions) => getFee(options),
  getOnRampAddress: (options: OnRampOptions) => getOnRampAddress(options),
  getTransferStatus: (options: TransferStatusOptions) => getTransferStatus(options),
})

async function getFee(options: FeeOptions) {
  assertAddress(options.routerAddress, `CCIP: router ${options.routerAddress} is not valid`)
  if (options.amount !== undefined && options.amount < 0n) {
    throw new Error('CCIP: amount must be non-negative')
  }
  if (!isAddress(options.destinationAccount)) {
    throw new Error(`CCIP: destination account ${options.destinationAccount} is invalid`)
  }
  if (options.tokenAddress) {
    assertAddress(options.tokenAddress, `CCIP: token ${options.tokenAddress} is invalid`)
  }
  if (options.feeTokenAddress) {
    assertAddress(options.feeTokenAddress, `CCIP: fee token ${options.feeTokenAddress} is invalid`)
  }

  const args = buildRouterArgs(options)
  const fee = (await readContract(options.client, {
    abi: ROUTER_ABI,
    address: options.routerAddress,
    functionName: 'getFee',
    args,
  })) as bigint

  return scaleFeeDecimals(fee, options.client.chain)
}

async function getOnRampAddress(options: OnRampOptions) {
  assertAddress(options.routerAddress, `CCIP: router ${options.routerAddress} is not valid`)
  const selector = toChainSelector(options.destinationChainSelector)
  const onRampAddress = (await readContract(options.client, {
    abi: ROUTER_ABI,
    address: options.routerAddress,
    functionName: 'getOnRamp',
    args: [selector],
  })) as Address

  assertAddress(onRampAddress, 'CCIP: onRamp address is not valid')
  return onRampAddress
}

async function getTransferStatus(options: TransferStatusOptions): Promise<TransferStatus | null> {
  assertAddress(
    options.destinationRouterAddress,
    `CCIP: destination router ${options.destinationRouterAddress} is not valid`,
  )
  if (!isHash(options.messageId)) {
    throw new Error(`CCIP: message id ${options.messageId} is not a valid hash`)
  }
  if (!options.sourceChainSelector) {
    throw new Error('CCIP: source chain selector is required')
  }

  const offRamps = (await readContract(options.client, {
    abi: ROUTER_ABI,
    address: options.destinationRouterAddress,
    functionName: 'getOffRamps',
  })) as { sourceChainSelector: bigint; offRamp: Address }[]

  const selector = toChainSelector(options.sourceChainSelector)
  const matchingOffRamps = offRamps.filter((offRamp) => offRamp.sourceChainSelector === selector)
  if (!matchingOffRamps.length) {
    throw new Error('CCIP: no matching off-ramp found')
  }

  let fromBlock = options.fromBlockNumber
  if (!fromBlock) {
    const latestBlock = await getBlockNumber(options.client)
    fromBlock =
      latestBlock > TRANSFER_STATUS_FROM_BLOCK_SHIFT
        ? latestBlock - TRANSFER_STATUS_FROM_BLOCK_SHIFT
        : 0n
  }

  for (const offRamp of matchingOffRamps) {
    const logs = await getLogs(options.client, {
      event: EXECUTION_STATE_CHANGED_EVENT,
      address: offRamp.offRamp,
      args: { messageId: options.messageId },
      fromBlock,
    })

    if (logs.length > 0) {
      // Use the latest log (last in the list) to get the most recent state
      const latestLog = logs[logs.length - 1]
      const state = Number(latestLog.args.state ?? TransferStatus.Untouched)
      return state as TransferStatus
    }
  }

  return null
}

function buildRouterArgs(options: FeeOptions) {
  const destinationChainSelector = toChainSelector(options.destinationChainSelector)
  const encodedReceiver = encodeAbiParameters(
    [{ type: 'address', name: 'receiver' }],
    [options.destinationAccount],
  )
  const gasLimit = BigInt(options.extraArgs?.gasLimit ?? 0)
  const allowOutOfOrderExecution =
    options.extraArgs?.allowOutOfOrderExecution === false ? false : true
  const encodedExtraArgs = encodeAbiParameters(
    [
      { type: 'uint256', name: 'gasLimit' },
      { type: 'bool', name: 'allowOutOfOrderExecution' },
    ],
    [gasLimit, allowOutOfOrderExecution],
  )
  const extraArgsTag = '0x181dcf10'
  const extraArgs = (extraArgsTag + encodedExtraArgs.slice(2)) as Hex

  return [
    destinationChainSelector,
    {
      receiver: encodedReceiver,
      data: options.data ?? zeroHash,
      tokenAmounts:
        options.amount && options.tokenAddress
          ? [{ token: options.tokenAddress, amount: options.amount }]
          : [],
      feeToken: options.feeTokenAddress ?? zeroAddress,
      extraArgs,
    },
  ] as const
}

function scaleFeeDecimals(fee: bigint, chain?: Chain) {
  if (!chain?.name) {
    return fee
  }
  const name = chain.name.toLowerCase()
  if (name.includes('hedera')) {
    return fee * 10n ** 10n
  }
  return fee
}

function assertAddress(address: Address | Hex, errorMessage: string) {
  if (!isAddress(address) || isAddressEqual(address, zeroAddress)) {
    throw new Error(errorMessage)
  }
}

function toChainSelector(selector: string) {
  return BigInt(selector)
}
