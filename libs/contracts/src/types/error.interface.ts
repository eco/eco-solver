// Error interface to break circular dependencies

export interface ErrorLike {
  message: string;
  name: string;
  toString(): string;
}

export interface LoggingError extends ErrorLike {
  stack?: string;
  cause?: unknown;
}