import { Logger } from '@nestjs/common';

import { EcoLogMessage } from '@/common/logging/eco-log-message';

export class EcoError extends Error {
  // Signature Validations
  static TypedDataVerificationFailed(errorMessage: string) {
    return new EcoError(`TypedData Verification Failed: ${errorMessage}`);
  }

  static InvalidURL = new EcoError('Invalid URL');
  static SolverRegistrationError = new EcoError('Solver Registration Error');
  static SolverRegistrationDisabled = new EcoError('Solver Registration is Disabled');

  static SignatureExpired = new EcoError('SignatureExpired');
  static InvalidSignature = new EcoError('InvalidSignature');

  static GaslessIntentsNotSupported = new Error('Gasless intents are not supported');
  static GaslessIntentInitiationError = new Error('Gasless intent initiation failed');

  static PermitProofConstructionFailed = new EcoError('Permit Proof Construction Failed');
  static MerkleTreeCreateError = new EcoError('Could not create Merkle tree');
  static CrossChainProofsError = new EcoError('Missing proof for chainID');
  static MerkleRootMismatch = new EcoError('Merkle root does not match expected value');

  // Permit Validations
  static InvalidPermitSignature = new EcoError('Invalid permit signature for owner');
  static PermitExpired = new EcoError('Permit expired for token');

  static IntentNotFound = new EcoError('Intent not found');

  static isEcoError(error: any): boolean {
    return error instanceof EcoError;
  }

  static getErrorObject(error: any): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(this.getErrorMessage(error));
  }

  static logError(error: any, caller: string, srcLogger: Logger, properties: object = {}): string {
    return this._logError(this.getErrorObject(error), caller, srcLogger, properties, false);
  }

  static logErrorWithStack(
    error: any,
    caller: string,
    srcLogger: Logger,
    properties: object = {},
  ): string {
    return this._logError(this.getErrorObject(error), caller, srcLogger, properties, true);
  }

  static _logError(
    error: Error,
    caller: string,
    srcLogger: Logger,
    properties: object,
    logStack?: boolean,
  ): string {
    const errorMessage = this.getErrorMessage(error);

    srcLogger.error(
      EcoLogMessage.fromDefault({
        message: `${caller}: error`,
        properties: {
          error: errorMessage,
          ...properties,
        },
      }),

      logStack && error.stack,
    );

    return errorMessage;
  }

  static getErrorMessage(error: any): string {
    if (this.isString(error)) {
      return error;
    }

    if (EcoError.isEcoError(error)) {
      return error.toString();
    }

    return (
      error.body ||
      error.error?.reason ||
      error.reason ||
      error.message ||
      error.enumKey ||
      'Unexpected error occurred'
    );
  }

  static isString(value: unknown): value is string {
    return typeof value === 'string';
  }
}
