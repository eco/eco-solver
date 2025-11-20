/**
 * Minimal CCIP helper derived from the MIT-licensed @chainlink/ccip-js package.
 * Reimplemented locally so we can run in CommonJS/Jest environments and keep a very small,
 * auditable surface area (fee quoting, on-ramp lookup, and transfer status polling).
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
  EXECUTION_STATE_CHANGED_EVENT_V1,
  EXECUTION_STATE_CHANGED_EVENT_V2,
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
  logger?: (event: string, details: Record<string, unknown>) => void
}

/**
 * Normalised CCIP execution states as returned by `getTransferStatus`.
 */
export enum TransferStatus {
  Untouched = 0,
  InProgress = 1,
  Success = 2,
  Failure = 3,
}

/**
 * Factory returning a tiny, object-shaped client so callers can depend on a stable
 * interface (`getFee`, `getOnRampAddress`, `getTransferStatus`) without importing
 * individual helpers.
 */
export const createClient = () => ({
  getFee: (options: FeeOptions) => getFee(options),
  getOnRampAddress: (options: OnRampOptions) => getOnRampAddress(options),
  getTransferStatus: (options: TransferStatusOptions) => getTransferStatus(options),
})

/**
 * Estimates CCIP fees via the Router `getFee` view call.
 * - Validates all provided addresses and amounts.
 * - Builds a Router payload that mirrors the eventual `ccipSend` call (same receiver,
 *   token, amount, feeToken, and extraArgs).
 * - Scales the raw fee for chains that report in non-18 decimal units (e.g. Hedera).
 */
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

/**
 * Returns the on-ramp address for a given Router + destination chain selector pair.
 * This is used by the provider to derive which on-ramp ABI / version emitted the
 * `CCIPSendRequested` / `CCIPMessageSent` event for a given transaction.
 */
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

/**
 * Polls the destination chain for an `ExecutionStateChanged` event matching a messageId.
 * - Discovers off-ramps via the Router, filters by `sourceChainSelector`, and walks each.
 * - Starts from a caller-provided `fromBlockNumber` or a recent block minus
 *   `TRANSFER_STATUS_FROM_BLOCK_SHIFT` to avoid scanning full history.
 * - Tries both v1 and v2 `ExecutionStateChanged` event signatures so it works for older
 *   and newer off-ramp deployments.
 * - Returns the last seen state or `null` when no logs are found.
 */
async function getTransferStatus(options: TransferStatusOptions): Promise<TransferStatus | null> {
  const log = (event: string, details: Record<string, unknown> = {}) =>
    options.logger?.(event, details)

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
  log('ccip.getTransferStatus.matchedOffRamps', {
    requestedSelector: selector.toString(),
    matchedCount: matchingOffRamps.length,
  })
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
  log('ccip.getTransferStatus.fromBlock', { fromBlock: fromBlock.toString() })

  const eventVariants = [EXECUTION_STATE_CHANGED_EVENT_V2, EXECUTION_STATE_CHANGED_EVENT_V1]

  for (const offRamp of matchingOffRamps) {
    for (const eventVariant of eventVariants) {
      const logs = await getLogs(options.client, {
        event: eventVariant,
        address: offRamp.offRamp,
        args: { messageId: options.messageId },
        fromBlock,
      })
      log('ccip.getTransferStatus.logsForOffRamp', {
        offRamp: offRamp.offRamp,
        logCount: logs.length,
        eventSignature: eventVariant.name,
      })

      if (logs.length > 0) {
        // Use the latest log (last in the list) to get the most recent state
        const latestLog = logs[logs.length - 1]
        const state = Number(latestLog.args.state ?? TransferStatus.Untouched)
        log('ccip.getTransferStatus.stateFound', {
          offRamp: offRamp.offRamp,
          state,
          eventSignature: eventVariant.name,
        })
        return state as TransferStatus
      }
    }
  }

  log('ccip.getTransferStatus.noLogs', {})
  return null
}

/**
 * Builds the Router arguments used for both fee estimation and send calls.
 * This mirrors the EVM2EVM token transfer layout:
 * - Encoded `receiver` address.
 * - Optional single-token `tokenAmounts` entry if token/amount are provided.
 * - Optional ERC-20 `feeToken` or zero-address for native gas.
 * - Extra args tagged with the CCIP V1 selector and containing gas limit + ordering flag.
 */
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

/**
 * Adjusts fee units for chains that report in non-18 decimal units.
 * Today this only applies to Hedera, where raw fees are 10 decimals lower than
 * the common EVM 18-decimal convention.
 */
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

/**
 * Asserts that an address is non-zero and syntactically valid.
 */
function assertAddress(address: Address | Hex, errorMessage: string) {
  if (!isAddress(address) || isAddressEqual(address, zeroAddress)) {
    throw new Error(errorMessage)
  }
}

/**
 * Normalises chain selectors from string form to bigint for use in Router / off-ramp calls.
 */
function toChainSelector(selector: string) {
  return BigInt(selector)
}
