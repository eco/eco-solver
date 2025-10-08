import { BadRequestException } from '@nestjs/common';

import { Address, Hex, verifyTypedData } from 'viem';

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
  static async validatePermit(permit: Permit3Params): Promise<void> {
    const { owner, salt, deadline, timestamp, merkleRoot, signature, permitContract } = permit;

    // Basic expiration check
    this.expirationCheck(deadline, 'deadline');

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
        throw new BadRequestException('Permit3 signature verification failed');
      }
    } catch (err) {
      throw new BadRequestException(
        `Permit3 signature validation error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  static expirationCheck(expiration: number | bigint, fieldName: string): void {
    const now = Math.floor(Date.now() / 1000);
    const expiry = typeof expiration === 'bigint' ? Number(expiration) : expiration;

    if (expiry < now) {
      throw new BadRequestException(`Permit expired ${now - expiry} seconds ago for ${fieldName}`);
    }
  }
}
