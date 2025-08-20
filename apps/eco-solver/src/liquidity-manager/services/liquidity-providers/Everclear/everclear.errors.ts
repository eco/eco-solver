export class EverclearError extends Error {
  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message)
    this.name = 'EverclearError'
  }
}

export class EverclearApiError extends EverclearError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorBody: string,
    context?: Record<string, any>,
  ) {
    super(message, { ...context, status, errorBody })
    this.name = 'EverclearApiError'
  }
}
