/**
 * Base error class for all TVM-related errors
 */
export class TvmError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'TvmError';
  }
}

/**
 * Error thrown when a TVM transaction fails
 */
export class TvmTransactionError extends TvmError {
  constructor(
    message: string,
    public readonly txId?: string,
    public readonly reason?: string,
  ) {
    super(message, 'TVM_TRANSACTION_ERROR');
    this.name = 'TvmTransactionError';
  }
}

/**
 * Error thrown when there's insufficient energy for a transaction
 */
export class TvmEnergyError extends TvmTransactionError {
  constructor(
    public readonly required: number,
    public readonly available: number,
    txId?: string,
  ) {
    super(
      `Insufficient energy: required ${required}, available ${available}`,
      txId,
      'INSUFFICIENT_ENERGY',
    );
    this.name = 'TvmEnergyError';
  }
}

/**
 * Error thrown when there's insufficient bandwidth for a transaction
 */
export class TvmBandwidthError extends TvmTransactionError {
  constructor(
    public readonly required: number,
    public readonly available: number,
    txId?: string,
  ) {
    super(
      `Insufficient bandwidth: required ${required}, available ${available}`,
      txId,
      'INSUFFICIENT_BANDWIDTH',
    );
    this.name = 'TvmBandwidthError';
  }
}

/**
 * Error thrown when an address is invalid
 */
export class TvmAddressError extends TvmError {
  constructor(public readonly address: string) {
    super(`Invalid Tron address: ${address}`, 'INVALID_ADDRESS');
    this.name = 'TvmAddressError';
  }
}

/**
 * Error thrown when a wallet operation fails
 */
export class TvmWalletError extends TvmError {
  constructor(message: string, public readonly walletType?: string) {
    super(message, 'WALLET_ERROR');
    this.name = 'TvmWalletError';
  }
}

/**
 * Error thrown when a configuration is invalid or missing
 */
export class TvmConfigError extends TvmError {
  constructor(message: string, public readonly configKey?: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'TvmConfigError';
  }
}

/**
 * Error thrown when a network operation fails
 */
export class TvmNetworkError extends TvmError {
  constructor(
    message: string,
    public readonly endpoint?: string,
    public readonly statusCode?: number,
  ) {
    super(message, 'NETWORK_ERROR');
    this.name = 'TvmNetworkError';
  }
}

/**
 * Error thrown when a contract call fails
 */
export class TvmContractError extends TvmError {
  constructor(
    message: string,
    public readonly contractAddress: string,
    public readonly method?: string,
  ) {
    super(message, 'CONTRACT_ERROR');
    this.name = 'TvmContractError';
  }
}