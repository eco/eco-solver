import { CallDataInterface, ERC20Abi } from '@/contracts'
import { QuoteError } from '@/quote/errors'
import { getFunctionCalls, getNativeCalls } from '../utils'
import { Hex, zeroAddress, getAddress, decodeFunctionData } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { normalizeTokenAmounts, NormalizableToken } from '@/quote/utils/token-normalization.utils'
import * as _ from 'lodash'

/**
 * Interface for parsed ERC20 calls
 */
export interface ParsedERC20Call {
  token: Hex
  amount: bigint
  recipient: Hex
  value: bigint
}

/**
 * Interface for parsed native calls
 */
export interface ParsedNativeCall {
  recipient: Hex
  value: bigint
}

/**
 * Interface for parsed calls data
 */
export interface ParsedCalls {
  erc20Calls: ParsedERC20Call[]
  nativeCalls: ParsedNativeCall[]
}

/**
 * Interface for route tokens
 */
export interface RouteToken {
  token: Hex
  amount: string | bigint
}

/**
 * Interface for normalize calls input
 */
export interface NormalizeCallsInput {
  calls: CallDataInterface[]
  chainId: number
  tokens?: RouteToken[]
}

/**
 * Decodes transfer call data using ERC20 ABI
 */
function decodeTransferCallWithABI(callData: Hex): { recipient: Hex; amount: bigint } | null {
  try {
    const decoded = decodeFunctionData({
      abi: ERC20Abi,
      data: callData,
    })

    if (decoded.functionName === 'transfer' && decoded.args && decoded.args.length >= 2) {
      return {
        recipient: decoded.args[0] as Hex,
        amount: decoded.args[1] as bigint,
      }
    }
  } catch (error) {
    // If decoding fails, return null
  }
  return null
}

/**
 * Validates that call targets exist in solver configuration
 */
function validateTargetsInSolverConfig(calls: CallDataInterface[], solver: any, chainId: number) {
  calls.forEach((call) => {
    const targetAddress = getAddress(call.target)

    // Find the target config by comparing checksummed addresses
    const targetConfig = Object.entries(solver.targets).find(
      ([address]) => getAddress(address) === targetAddress,
    )?.[1] as { contractType: string } | undefined

    if (!targetConfig) {
      throw QuoteError.FailedToFetchTarget(BigInt(chainId), call.target)
    }

    // If target is ERC20, validate it's a transfer call
    if (targetConfig.contractType === 'erc20') {
      const decodedCall = decodeTransferCallWithABI(call.data)
      if (!decodedCall) {
        throw QuoteError.InvalidFunctionCall(call.target, targetConfig.contractType)
      }
    }
  })
}

/**
 * Parses route calls into structured ERC20 and native calls with normalized amounts
 */
export function parseRouteCalls(
  calls: CallDataInterface[],
  chainId: number,
  ecoConfigService: EcoConfigService,
): ParsedCalls {
  const erc20Calls: ParsedERC20Call[] = []
  const nativeCalls: ParsedNativeCall[] = []

  // Get solver configuration for validation
  const solver = ecoConfigService.getSolver(chainId)
  if (!solver) {
    throw QuoteError.NoSolverForDestination(BigInt(chainId))
  }

  // Parse functional calls (ERC20 transfers)
  const functionalCalls = getFunctionCalls(calls)
  if (functionalCalls.length > 0) {
    validateTargetsInSolverConfig(functionalCalls, solver, chainId)

    // Create tokens array for centralized normalization - only for ERC20 tokens
    const tokensToNormalize: NormalizableToken[] = []
    const erc20CallsData: Array<{ call: any; decodedCall: any }> = []

    functionalCalls.forEach((call) => {
      // Check if this is an ERC20 target by looking up config
      const targetAddress = getAddress(call.target)
      const targetConfig = Object.entries(solver.targets).find(
        ([address]) => getAddress(address) === targetAddress,
      )?.[1] as { contractType: string } | undefined

      // Only process ERC20 contracts
      if (targetConfig?.contractType === 'erc20') {
        // Get decoded call data (already validated in helper method)
        const decodedCall = decodeTransferCallWithABI(call.data)!

        tokensToNormalize.push({
          token: call.target,
          amount: decodedCall.amount,
        })

        erc20CallsData.push({ call, decodedCall })
      }
    })

    // Use centralized normalization utility only if we have ERC20 tokens to process
    if (tokensToNormalize.length > 0) {
      try {
        const normalizedTokens = normalizeTokenAmounts(tokensToNormalize, chainId)

        // Build erc20Calls array with normalized amounts
        erc20CallsData.forEach((item, index) => {
          const normalizedToken = normalizedTokens[index]

          erc20Calls.push({
            token: getAddress(item.call.target),
            amount: normalizedToken.amount as bigint,
            recipient: getAddress(item.decodedCall.recipient),
            value: item.call.value,
          })
        })
      } catch (error) {
        // Convert EcoError.UnknownTokenError to QuoteError for consistency
        if (error instanceof Error && error.message.includes('Unknown token')) {
          const tokenMatch = error.message.match(/token ([0-9a-fA-Fx]+) on chain (\d+)/)
          if (tokenMatch) {
            throw QuoteError.FailedToFetchTarget(BigInt(tokenMatch[2]), tokenMatch[1] as Hex)
          }
        }
        throw error
      }
    }
  }

  // Parse native calls, these are 1-1 and only between the same gas token so decimal precision is not an issue
  const nativeCallsData = getNativeCalls(calls)
  nativeCallsData.forEach((call) => {
    nativeCalls.push({
      recipient: getAddress(call.target),
      value: call.value,
    })
  })

  return { erc20Calls, nativeCalls }
}

/**
 * Validates that parsed calls match the provided tokens array
 */
export function validateCallsMatchTokens(parsedCalls: ParsedCalls, tokens: RouteToken[]) {
  // Extract token addresses and amounts using lodash
  const routeTokenAddresses = tokens.map((token) => getAddress(token.token))
  const callTokenAddresses = parsedCalls.erc20Calls.map((call) => getAddress(call.token))

  // Validate that each call token is included in route tokens
  const callsNotInTokens = _.difference(callTokenAddresses, routeTokenAddresses)
  if (callsNotInTokens.length > 0) {
    throw QuoteError.CallTokenNotInRouteTokens(callsNotInTokens as Hex[])
  }

  // Validate that each non-native route token has a corresponding call
  const nonNativeTokens = tokens.filter(
    (token) => getAddress(token.token) !== getAddress(zeroAddress),
  )
  const nonNativeTokenAddresses = nonNativeTokens.map((token) => getAddress(token.token))
  const tokensNotInCalls = _.difference(nonNativeTokenAddresses, callTokenAddresses)
  if (tokensNotInCalls.length > 0) {
    throw QuoteError.TokenNotInRouteCalls(tokensNotInCalls as Hex[])
  }

  // Validate that amounts match between parsed calls and route tokens (both are now normalized to 18 decimals)
  parsedCalls.erc20Calls.forEach((call) => {
    const matchingToken = tokens.find((token) => getAddress(token.token) === getAddress(call.token))
    if (matchingToken && BigInt(matchingToken.amount) !== call.amount) {
      throw QuoteError.CallAmountMismatchTokenAmount(
        call.token,
        call.amount,
        BigInt(matchingToken.amount),
      )
    }
  })
}

/**
 * Normalizes route calls by parsing them and validating against tokens array
 * This utility combines parseRouteCalls and validateCallsMatchTokens functionality
 */
export function normalizeRouteCalls(
  input: NormalizeCallsInput,
  ecoConfigService: EcoConfigService,
): ParsedCalls {
  const { calls, chainId, tokens = [] } = input

  // Parse the calls into structured format with normalized amounts
  const parsedCalls = parseRouteCalls(calls, chainId, ecoConfigService)

  // Validate parsed calls match tokens array if there are any ERC20 calls
  // This ensures that if there are ERC20 calls, they must be present in the tokens array
  if (parsedCalls.erc20Calls.length > 0) {
    validateCallsMatchTokens(parsedCalls, tokens)
  }

  return parsedCalls
}
