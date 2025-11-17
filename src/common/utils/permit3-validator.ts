import { Address, Hex, verifyTypedData } from 'viem';

import { EcoResponse } from '@/common/eco-response';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoLogger } from '@/common/logging/eco-logger';
import { EcoError } from '@/errors/eco-error';

// Typed data for EIP-712 signature verification
const types = {
  Permit3: [
    { name: 'owner', type: 'address' },
    { name: 'salt', type: 'bytes32' },
    { name: 'deadline', type: 'uint48' },
    { name: 'timestamp', type: 'uint48' },
    { name: 'merkleRoot', type: 'bytes32' },
  ],
};

export interface Permit3Params {
  owner: Hex;
  salt: Hex;
  deadline: number | bigint; // uint48
  timestamp: number | bigint; // uint48
  merkleRoot: Hex;
  signature: Hex;
  permitContract: Hex;
}

export class Permit3Validator {
  private static logger = new EcoLogger(Permit3Validator.name);

  static async validatePermit(permit: Permit3Params): Promise<EcoResponse<void>> {
    const { owner, salt, deadline, timestamp, merkleRoot, signature, permitContract } = permit;

    // Basic expiration check
    const { error: expirationError } = this.expirationCheck(deadline, `deadline`);

    if (expirationError) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Permit3 expirationError check failed`,
          properties: {
            deadline,
          },
        }),
      );

      return { error: expirationError };
    }

    try {
      const validSig = await verifyTypedData({
        address: owner.toLowerCase() as Address,
        domain: {
          name: 'Permit3',
          version: '1',
          chainId: 1,
          verifyingContract: permitContract.toLowerCase() as Address,
        },
        types,
        primaryType: 'Permit3',
        message: {
          owner: owner.toLowerCase() as Address,
          salt,
          deadline: BigInt(deadline),
          timestamp: Number(timestamp),
          merkleRoot,
        },
        signature,
      });

      if (!validSig) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Permit3 signature verification failed`,
            properties: { permit },
          }),
        );
        return { error: EcoError.InvalidPermitSignature };
      }

      return {};
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Permit3 signature validation threw`,
          properties: {
            error: ex instanceof Error ? ex.message : String(ex),
            permit,
          },
        }),
      );

      return { error: EcoError.InvalidPermitSignature };
    }
  }

  static expirationCheck(expiration: number | bigint, logMessage: string): EcoResponse<void> {
    const now = Math.floor(Date.now() / 1000);
    const expiry = typeof expiration === 'bigint' ? Number(expiration) : expiration;

    if (expiry < now) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `Permit expired ${now - expiry} seconds ago for ${logMessage}`,
        }),
      );

      return { error: EcoError.PermitExpired };
    }

    return {};
  }
}
