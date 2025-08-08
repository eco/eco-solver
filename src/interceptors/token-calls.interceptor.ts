import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteError } from '@/quote/errors'
import { CallDataInterface, ERC20Abi } from '@/contracts'
import { getFunctionCalls, getNativeCalls } from '@/intent/utils'
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
 * TokenCallsInterceptor parses route.calls and adds a parsedCalls field with normalized call data.
 *
 * This interceptor:
 * - Parses route.calls byte data to extract ERC20 transfer calls and native calls
 * - Normalizes amounts from original decimals to 18 decimals
 * - Validates that parsed calls match the tokens array
 * - Adds parsedCalls field to the request body for services to use
 *
 * The interceptor uses config-based decimal lookup from @eco-foundation/chains
 * instead of balance service for performance and consistency.
 */
@Injectable()
export class TokenCallsInterceptor implements NestInterceptor {
  constructor(private readonly ecoConfigService: EcoConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()

    // Parse and add calls data to request body (synchronous)
    if (request.body) {
      this.transformIncomingCalls(request.body)
    }

    return next.handle().pipe(
      map((data) => {
        // Remove parsedCalls from outgoing response
        return this.transformOutgoingResponse(data)
      }),
    )
  }

  private transformIncomingCalls(quoteIntentData: QuoteIntentDataDTO) {
    // Handle QuoteIntentDataDTO structure (incoming request)
    if (
      quoteIntentData.route &&
      quoteIntentData.route.calls &&
      quoteIntentData.route.calls.length > 0
    ) {
      const parsedCalls = this.parseRouteCalls(
        quoteIntentData.route.calls as CallDataInterface[],
        Number(quoteIntentData.route.destination),
      )

      // Validate parsed calls against tokens array
      this.validateCallsMatchTokens(parsedCalls, quoteIntentData)

      // Add parsedCalls field to route for services to use
      //@ts-expect-error we add this field for services to use
      quoteIntentData.route.parsedCalls = parsedCalls
    }
  }

  private transformOutgoingResponse(data: any): any {
    // Remove parsedCalls field from any responses if it exists
    if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        return data.map((item) => this.removeParsedCallsFromItem(item))
      } else {
        return this.removeParsedCallsFromItem(data)
      }
    }
    return data
  }

  private removeParsedCallsFromItem(item: any): any {
    if (item && typeof item === 'object') {
      // Remove parsedCalls from top level if it exists
      if ('parsedCalls' in item) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { parsedCalls: _parsedCalls, ...rest } = item
        item = rest
      }

      // Remove parsedCalls from route if it exists
      if (item.route && typeof item.route === 'object' && 'parsedCalls' in item.route) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { parsedCalls: _parsedCalls, ...restRoute } = item.route
        item = { ...item, route: restRoute }
      }

      // Handle nested objects that might contain routes with parsedCalls
      if (item.quoteEntries && Array.isArray(item.quoteEntries)) {
        item.quoteEntries = item.quoteEntries.map((entry: any) =>
          this.removeParsedCallsFromItem(entry),
        )
      }
    }
    return item
  }

  private parseRouteCalls(calls: CallDataInterface[], chainId: number): ParsedCalls {
    const erc20Calls: ParsedERC20Call[] = []
    const nativeCalls: ParsedNativeCall[] = []

    // Get solver configuration for validation
    const solver = this.ecoConfigService.getSolver(chainId)
    if (!solver) {
      throw QuoteError.NoSolverForDestination(BigInt(chainId))
    }

    // Parse functional calls (ERC20 transfers)
    const functionalCalls = getFunctionCalls(calls)
    if (functionalCalls.length > 0) {
      this.validateTargetsInSolverConfig(functionalCalls, solver, chainId)

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
          const decodedCall = this.decodeTransferCallWithABI(call.data)!

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
              token: item.call.target,
              amount: normalizedToken.amount as bigint,
              recipient: item.decodedCall.recipient,
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
        recipient: call.target,
        value: call.value,
      })
    })

    return { erc20Calls, nativeCalls }
  }

  private decodeTransferCallWithABI(callData: Hex): { recipient: Hex; amount: bigint } | null {
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

  private validateCallsMatchTokens(parsedCalls: ParsedCalls, quoteIntentData: QuoteIntentDataDTO) {
    const routeTokens = quoteIntentData.route?.tokens || []

    // Extract token addresses and amounts using lodash
    const routeTokenAddresses = routeTokens.map((token) => getAddress(token.token))
    const callTokenAddresses = parsedCalls.erc20Calls.map((call) => getAddress(call.token))

    // Validate that each call token is included in route tokens
    const callsNotInTokens = _.difference(callTokenAddresses, routeTokenAddresses)
    if (callsNotInTokens.length > 0) {
      throw QuoteError.CallTokenNotInRouteTokens(callsNotInTokens as Hex[])
    }

    // Validate that each non-native route token has a corresponding call
    const nonNativeTokens = routeTokens.filter(
      (token) => getAddress(token.token) !== getAddress(zeroAddress),
    )
    const nonNativeTokenAddresses = nonNativeTokens.map((token) => getAddress(token.token))
    const tokensNotInCalls = _.difference(nonNativeTokenAddresses, callTokenAddresses)
    if (tokensNotInCalls.length > 0) {
      throw QuoteError.TokenNotInRouteCalls(tokensNotInCalls as Hex[])
    }

    // Validate that amounts match between parsed calls and route tokens (both are now normalized to 18 decimals)
    parsedCalls.erc20Calls.forEach((call) => {
      const matchingToken = routeTokens.find(
        (token) => getAddress(token.token) === getAddress(call.token),
      )
      if (matchingToken && BigInt(matchingToken.amount) !== call.amount) {
        throw QuoteError.CallAmountMismatchTokenAmount(
          call.token,
          call.amount,
          BigInt(matchingToken.amount),
        )
      }
    })
  }

  private validateTargetsInSolverConfig(calls: CallDataInterface[], solver: any, chainId: number) {
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
        const decodedCall = this.decodeTransferCallWithABI(call.data)
        if (!decodedCall) {
          throw QuoteError.InvalidFunctionCall(call.target, targetConfig.contractType)
        }
      }
    })
  }
}
