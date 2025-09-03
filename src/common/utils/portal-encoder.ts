/**
 * Portal Encoder Utility
 *
 * Provides chain-specific encoding and decoding for Portal contract data structures.
 * Each blockchain type (EVM, TVM, SVM) has its own encoding format:
 * - EVM: ABI encoding (hex)
 * - TVM: ABI encoding (hex)
 * - SVM: Borsh serialization
 */

import { PublicKey } from '@solana/web3.js';
import { deserialize, Schema, serialize } from 'borsh';
import { decodeAbiParameters, encodeAbiParameters, Hex, parseAbiParameters } from 'viem';

import { TvmUtilsService } from '@/modules/blockchain/tvm/services';

import { EVMRewardAbiItem, EVMRouteAbiItem } from '../abis/portal.abi';
import { Intent } from '../interfaces/intent.interface';

import { AddressNormalizer } from './address-normalizer';
import { ChainType } from './chain-type-detector';

export class PortalEncoder {
  /**
   * Encodes Intent data for a specific chain type
   *
   * @param data - Data to encode (Route or Reward from Intent)
   * @param chainType - Target chain type
   * @returns Encoded data as Buffer
   */
  static encodeForChain(data: Intent['route'] | Intent['reward'], chainType: ChainType): Buffer {
    switch (chainType) {
      case ChainType.EVM:
        return this.encodeEvm(data);
      case ChainType.TVM:
        return this.encodeTvm(data);
      case ChainType.SVM:
        return this.encodeSvm(data);
      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  /**
   * Decodes data from a specific chain type to Intent format
   *
   * @param data - Encoded data as Buffer or string
   * @param chainType - Source chain type
   * @param dataType - Type of data ('route' or 'reward')
   * @returns Decoded Route or Reward object in Intent format
   */
  static decodeFromChain<Type extends 'route' | 'reward'>(
    data: Buffer | string,
    chainType: ChainType,
    dataType: Type,
  ): Type extends 'route' ? Intent['route'] : Intent['reward'] {
    switch (chainType) {
      case ChainType.EVM:
        return this.decodeEvm(data, dataType);
      case ChainType.TVM:
        return this.decodeTvm(data, dataType);
      case ChainType.SVM:
        return this.decodeSvm(data, dataType);
      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  /**
   * EVM encoding using ABI parameters
   */
  private static encodeEvm(data: Intent['route'] | Intent['reward']): Buffer {
    if (this.isRoute(data)) {
      const encoded = encodeAbiParameters(
        parseAbiParameters(
          '(bytes32,uint64,address,(address,uint256)[],(address,bytes,uint256)[])',
        ),
        [
          [
            data.salt,
            data.deadline,
            AddressNormalizer.denormalizeToEvm(data.portal),
            data.tokens.map(
              (t) => [AddressNormalizer.denormalizeToEvm(t.token), t.amount] as const,
            ),
            data.calls.map(
              (c) => [AddressNormalizer.denormalizeToEvm(c.target), c.data, c.value] as const,
            ),
          ],
        ],
      );
      return Buffer.from(encoded.slice(2), 'hex'); // Remove 0x prefix
    } else {
      const encoded = encodeAbiParameters(
        parseAbiParameters('(uint64,address,address,uint256,(address,uint256)[])'),
        [
          [
            data.deadline,
            AddressNormalizer.denormalizeToEvm(data.creator),
            AddressNormalizer.denormalizeToEvm(data.prover),
            data.nativeAmount,
            data.tokens.map(
              (t) => [AddressNormalizer.denormalizeToEvm(t.token), t.amount] as const,
            ),
          ],
        ],
      );
      return Buffer.from(encoded.slice(2), 'hex'); // Remove 0x prefix
    }
  }

  /**
   * TVM encoding using JSON with Base58 addresses
   */
  private static encodeTvm(data: Intent['route'] | Intent['reward']): Buffer {
    if (this.isRoute(data)) {
      const tvmData = {
        salt: data.salt,
        deadline: data.deadline.toString(),
        portal: AddressNormalizer.denormalize(data.portal, ChainType.TVM),
        tokens: data.tokens.map((t) => ({
          token: AddressNormalizer.denormalize(t.token, ChainType.TVM),
          amount: t.amount.toString(),
        })),
        calls: data.calls.map((c) => ({
          target: AddressNormalizer.denormalize(c.target, ChainType.TVM),
          data: c.data,
          value: c.value.toString(),
        })),
      };
      return Buffer.from(JSON.stringify(tvmData), 'utf8');
    } else {
      const tvmData = {
        deadline: data.deadline.toString(),
        creator: AddressNormalizer.denormalize(data.creator, ChainType.TVM),
        prover: AddressNormalizer.denormalize(data.prover, ChainType.TVM),
        nativeAmount: data.nativeAmount.toString(),
        tokens: data.tokens.map((t) => ({
          token: AddressNormalizer.denormalize(t.token, ChainType.TVM),
          amount: t.amount.toString(),
        })),
      };
      return Buffer.from(JSON.stringify(tvmData), 'utf8');
    }
  }

  /**
   * Borsh schemas for SVM types using classic borsh library
   */
  private static readonly SVM_ROUTE_SCHEMA: Schema = {
    struct: {
      salt: { array: { type: 'u8', len: 32 } },
      deadline: 'u64',
      portal: { array: { type: 'u8', len: 32 } },
      tokens: {
        array: {
          type: {
            struct: {
              token: { array: { type: 'u8', len: 32 } },
              amount: 'u64',
            },
          },
        },
      },
      calls: {
        array: {
          type: {
            struct: {
              target: { array: { type: 'u8', len: 32 } },
              data: { array: { type: 'u8' } },
              value: 'u64',
            },
          },
        },
      },
    },
  };

  private static readonly SVM_REWARD_SCHEMA: Schema = {
    struct: {
      deadline: 'u64',
      creator: { array: { type: 'u8', len: 32 } },
      prover: { array: { type: 'u8', len: 32 } },
      nativeAmount: 'u64',
      tokens: {
        array: {
          type: {
            struct: {
              token: { array: { type: 'u8', len: 32 } },
              amount: 'u64',
            },
          },
        },
      },
    },
  };

  /**
   * SVM encoding using proper Borsh serialization
   */
  private static encodeSvm(data: Intent['route'] | Intent['reward']): Buffer {
    if (this.isRoute(data)) {
      // Prepare route data for Borsh
      const routeData = {
        salt: Array.from(Buffer.from(data.salt.slice(2), 'hex')),
        deadline: data.deadline.toString(),
        portal: this.addressToBytes32(AddressNormalizer.denormalizeToSvm(data.portal)),
        tokens: data.tokens.map((t) => ({
          token: Array.from(new PublicKey(AddressNormalizer.denormalizeToSvm(t.token)).toBytes()),
          amount: t.amount.toString(),
        })),
        calls: data.calls.map((c) => ({
          target: this.addressToBytes32(AddressNormalizer.denormalizeToSvm(c.target)),
          data: Array.from(Buffer.from(c.data.slice(2), 'hex')),
          value: c.value.toString(),
        })),
      };

      // Serialize using Borsh
      return Buffer.from(serialize(this.SVM_ROUTE_SCHEMA, routeData));
    } else {
      // Prepare reward data for Borsh
      const rewardData = {
        deadline: data.deadline.toString(),
        creator: Array.from(
          new PublicKey(AddressNormalizer.denormalizeToSvm(data.creator)).toBytes(),
        ),
        prover: Array.from(
          new PublicKey(AddressNormalizer.denormalizeToSvm(data.prover)).toBytes(),
        ),
        nativeAmount: data.nativeAmount.toString(),
        tokens: data.tokens.map((t) => ({
          token: Array.from(new PublicKey(AddressNormalizer.denormalizeToSvm(t.token)).toBytes()),
          amount: t.amount.toString(),
        })),
      };

      // Serialize using Borsh
      return Buffer.from(serialize(this.SVM_REWARD_SCHEMA, rewardData));
    }
  }

  /**
   * Helper to convert address to 32-byte array for SVM
   */
  private static addressToBytes32(address: string): number[] {
    if (address.startsWith('0x')) {
      const bytes = Buffer.from(address.slice(2), 'hex');
      const result = new Uint8Array(32);
      result.set(bytes.slice(0, 32));
      return Array.from(result);
    }
    // For Solana base58 addresses
    const publicKey = new PublicKey(address);
    return Array.from(publicKey.toBytes());
  }

  /**
   * EVM decoding to Intent format
   */
  private static decodeEvm<Type extends 'route' | 'reward'>(
    data: Buffer | string,
    dataType: Type,
  ): Type extends 'route' ? Intent['route'] : Intent['reward'] {
    const dataString = typeof data === 'string' ? data : '0x' + data.toString('hex');

    if (dataType === 'reward') {
      const decoded = decodeAbiParameters([EVMRewardAbiItem], dataString as Hex)[0];

      return {
        deadline: decoded.deadline,
        creator: AddressNormalizer.normalize(decoded.creator, ChainType.EVM),
        prover: AddressNormalizer.normalize(decoded.prover, ChainType.EVM),
        nativeAmount: decoded.nativeAmount,
        tokens: decoded.tokens.map((t) => ({
          token: AddressNormalizer.normalize(t.token, ChainType.EVM),
          amount: t.amount,
        })),
      } as Intent['reward'] as Type extends 'route' ? Intent['route'] : Intent['reward'];
    }

    const decoded = decodeAbiParameters([EVMRouteAbiItem], dataString as Hex)[0];
    return {
      salt: decoded.salt,
      deadline: decoded.deadline,
      portal: AddressNormalizer.normalize(decoded.portal, ChainType.EVM),
      nativeAmount: decoded.nativeAmount || 0n,
      tokens: decoded.tokens.map((t) => ({
        token: AddressNormalizer.normalize(t.token, ChainType.EVM),
        amount: t.amount,
      })),
      calls: decoded.calls.map((c) => ({
        target: AddressNormalizer.normalize(c.target, ChainType.EVM),
        data: c.data,
        value: c.value,
      })),
    } as Intent['route'] as Type extends 'route' ? Intent['route'] : Intent['reward'];
  }

  /**
   * EVM decoding to Intent format
   */
  private static decodeTvm<Type extends 'route' | 'reward'>(
    data: Buffer | string,
    dataType: Type,
  ): Type extends 'route' ? Intent['route'] : Intent['reward'] {
    const dataString = typeof data === 'string' ? data : '0x' + data.toString('hex');

    if (dataType === 'reward') {
      const decoded = decodeAbiParameters([EVMRewardAbiItem], dataString as Hex)[0];

      return {
        deadline: decoded.deadline,
        creator: AddressNormalizer.normalize(
          TvmUtilsService.fromEvm(decoded.creator),
          ChainType.TVM,
        ),
        prover: AddressNormalizer.normalize(TvmUtilsService.fromEvm(decoded.prover), ChainType.TVM),
        nativeAmount: decoded.nativeAmount,
        tokens: decoded.tokens.map((t) => ({
          token: AddressNormalizer.normalize(TvmUtilsService.fromEvm(t.token), ChainType.TVM),
          amount: t.amount,
        })),
      } as Intent['reward'] as Type extends 'route' ? Intent['route'] : Intent['reward'];
    }

    const decoded = decodeAbiParameters([EVMRouteAbiItem], dataString as Hex)[0];
    return {
      salt: decoded.salt,
      deadline: decoded.deadline,
      portal: AddressNormalizer.normalize(TvmUtilsService.fromEvm(decoded.portal), ChainType.TVM),
      nativeAmount: decoded.nativeAmount || 0n,
      tokens: decoded.tokens.map((t) => ({
        token: AddressNormalizer.normalize(TvmUtilsService.fromEvm(t.token), ChainType.TVM),
        amount: t.amount,
      })),
      calls: decoded.calls.map((c) => ({
        target: AddressNormalizer.normalize(TvmUtilsService.fromEvm(c.target), ChainType.TVM),
        data: c.data,
        value: c.value,
      })),
    } as Intent['route'] as Type extends 'route' ? Intent['route'] : Intent['reward'];
  }

  /**
   * SVM decoding from Borsh to Intent format
   */
  private static decodeSvm<Type extends 'route' | 'reward'>(
    data: Buffer | string,
    dataType: Type,
  ): Type extends 'route' ? Intent['route'] : Intent['reward'] {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'hex') : data;

    if (dataType === 'route') {
      // Decode route using Borsh
      const decoded = deserialize(this.SVM_ROUTE_SCHEMA, buffer) as any;

      return {
        salt: ('0x' + Buffer.from(decoded.salt).toString('hex')) as Hex,
        deadline: BigInt(decoded.deadline),
        portal: AddressNormalizer.normalizeSvm(this.bytes32ToAddress(decoded.portal)),
        nativeAmount: 0n, // Route doesn't have nativeAmount in the schema
        tokens: decoded.tokens.map((t: any) => ({
          token: AddressNormalizer.normalizeSvm(this.bytes32ToAddress(t.token)),
          amount: BigInt(t.amount),
        })),
        calls: decoded.calls.map((c: any) => ({
          target: AddressNormalizer.normalizeSvm(this.bytes32ToAddress(c.target)),
          data: ('0x' + Buffer.from(c.data).toString('hex')) as Hex,
          value: BigInt(c.value),
        })),
      } as Type extends 'route' ? Intent['route'] : Intent['reward'];
    }

    // Decode reward using Borsh
    const decoded = deserialize(this.SVM_REWARD_SCHEMA, buffer) as any;

    return {
      deadline: BigInt(decoded.deadline),
      creator: AddressNormalizer.normalizeSvm(this.bytes32ToAddress(decoded.creator)),
      prover: AddressNormalizer.normalizeSvm(this.bytes32ToAddress(decoded.prover)),
      nativeAmount: BigInt(decoded.nativeAmount),
      tokens: decoded.tokens.map((t: any) => ({
        token: AddressNormalizer.normalizeSvm(this.bytes32ToAddress(t.token)),
        amount: BigInt(t.amount),
      })),
    } as Type extends 'route' ? Intent['route'] : Intent['reward'];
  }

  /**
   * Helper to convert 32-byte array to address for SVM
   */
  private static bytes32ToAddress(bytes: number[] | Uint8Array): string {
    const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    // Check if it looks like a Solana public key (32 bytes, non-zero)
    const pubkey = new PublicKey(buffer);
    return pubkey.toString();
  }

  /**
   * Type guard to determine if data is a Route
   */
  private static isRoute(data: Intent['route'] | Intent['reward']): data is Intent['route'] {
    return 'salt' in data && 'portal' in data && 'calls' in data;
  }
}
