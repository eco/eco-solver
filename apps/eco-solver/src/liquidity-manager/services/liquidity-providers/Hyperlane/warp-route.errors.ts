export class WarpRouteError extends Error {
  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message)
    this.name = 'WarpRouteError'
  }
}

export class WarpRouteNotFoundError extends WarpRouteError {
  constructor(chainId: number, tokenAddress: string) {
    super(`Warp route not found for token ${tokenAddress} on chain ${chainId}`, {
      chainId,
      tokenAddress,
    })
    this.name = 'WarpRouteNotFoundError'
  }
}

export class UnsupportedActionPathError extends WarpRouteError {
  constructor(
    tokenIn: { address: string; chainId: number },
    tokenOut: { address: string; chainId: number },
  ) {
    super('Unsupported action path for token pair', {
      tokenIn,
      tokenOut,
    })
    this.name = 'UnsupportedActionPathError'
  }
}

export class UnsupportedWalletError extends WarpRouteError {
  constructor(walletAddress: string) {
    super(`Wallet ${walletAddress} is not supported for WarpRoute execution`, {
      walletAddress,
    })
    this.name = 'UnsupportedWalletError'
  }
}

export class MessageDispatchError extends WarpRouteError {
  constructor(transactionHash: string) {
    super('No message dispatched in transaction', {
      transactionHash,
    })
    this.name = 'MessageDispatchError'
  }
}

export class PartialQuoteError extends WarpRouteError {
  constructor(reason: string, context?: Record<string, any>) {
    super(`Unable to get partial quote: ${reason}`, context)
    this.name = 'PartialQuoteError'
  }
}

export class InvalidInputError extends WarpRouteError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
    this.name = 'InvalidInputError'
  }
}
