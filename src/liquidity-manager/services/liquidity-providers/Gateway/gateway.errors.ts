export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

export class GatewayApiError extends GatewayError {
  constructor(
    message: string,
    public readonly status: number,
    context?: Record<string, any>,
  ) {
    super(message, context)
    this.name = 'GatewayApiError'
  }
}

export class GatewayQuoteValidationError extends GatewayError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
    this.name = 'GatewayQuoteValidationError'
  }
}
