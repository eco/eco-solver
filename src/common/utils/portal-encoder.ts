/**
 * Portal Encoder Utility
 *
 * Provides chain-specific encoding and decoding for Portal contract data structures.
 * Each blockchain type (EVM, TVM, SVM) has its own encoding format:
 * - EVM: ABI encoding (hex)
 * - TVM: ABI encoding (hex)
 * - SVM: Borsh serialization
 */

import { BN, BorshCoder } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { decodeAbiParameters, encodeAbiParameters, Hex } from 'viem';

import { portalIdl } from '@/modules/blockchain/svm/targets/idl/portal.idl';
import {
  RewardInstruction,
  RouteInstruction,
} from '@/modules/blockchain/svm/targets/types/portal-idl.type';
import { Snakify } from '@/modules/blockchain/svm/types/snake-case.types';
import { bufferToBytes32, bytes32ToAddress } from '@/modules/blockchain/svm/utils/converter';
import { prepareSvmRoute } from '@/modules/blockchain/svm/utils/instruments';
import { TvmUtilsService } from '@/modules/blockchain/tvm/services';

import { EVMRewardAbiItem, EVMRouteAbiItem } from '../abis/portal.abi';
import { Intent } from '../interfaces/intent.interface';

import { AddressNormalizer } from './address-normalizer';
import { ChainType } from './chain-type-detector';

const svmCoder = new BorshCoder(portalIdl);

export class PortalEncoder {
  /**
   * Encodes Intent data for a specific chain type
   *
   * @param data - Data to encode (Route or Reward from Intent)
   * @param chainType - Target chain type
   * @returns Encoded data as Buffer
   */
  static encode(data: Intent['route'] | Intent['reward'], chainType: ChainType): Buffer {
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
  static decode<Type extends 'route' | 'reward'>(
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
   * Type guard to determine if data is a Route
   */
  static isRoute(data: Intent['route'] | Intent['reward']): data is Intent['route'] {
    return 'salt' in data && 'portal' in data && 'calls' in data;
  }

  /**
   * EVM encoding using ABI parameters
   */
  private static encodeEvm(data: Intent['route'] | Intent['reward']): Buffer {
    if (this.isRoute(data)) {
      const encoded = encodeAbiParameters(
        [EVMRouteAbiItem],
        [
          {
            salt: data.salt,
            deadline: data.deadline,
            nativeAmount: data.nativeAmount,
            portal: AddressNormalizer.denormalizeToEvm(data.portal),
            tokens: data.tokens.map((t) => ({
              token: AddressNormalizer.denormalizeToEvm(t.token),
              amount: t.amount,
            })),
            calls: data.calls.map((c) => ({
              target: AddressNormalizer.denormalizeToEvm(c.target),
              data: c.data,
              value: c.value,
            })),
          },
        ],
      );
      return Buffer.from(encoded.slice(2), 'hex'); // Remove 0x prefix
    } else {
      const encoded = encodeAbiParameters(
        [EVMRewardAbiItem],
        [
          {
            deadline: data.deadline,
            creator: AddressNormalizer.denormalizeToEvm(data.creator),
            prover: AddressNormalizer.denormalizeToEvm(data.prover),
            nativeAmount: data.nativeAmount,
            tokens: data.tokens.map((t) => ({
              token: AddressNormalizer.denormalizeToEvm(t.token),
              amount: t.amount,
            })),
          },
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
   * SVM encoding using proper Borsh serialization
   */
  private static encodeSvm(data: Intent['route'] | Intent['reward']): Buffer {
    if (PortalEncoder.isRoute(data)) {
      const route = prepareSvmRoute(data);
      return svmCoder.types.encode('Route', route);
    } else {
      return svmCoder.types.encode('Reward', {
        deadline: new BN(data.deadline.toString()),
        creator: new PublicKey(AddressNormalizer.denormalizeToSvm(data.creator)),
        prover: new PublicKey(AddressNormalizer.denormalizeToSvm(data.prover)),
        native_amount: new BN(data.nativeAmount.toString()),
        tokens: data.tokens.map(({ token, amount }) => ({
          token: new PublicKey(AddressNormalizer.denormalizeToSvm(token)),
          amount: new BN(amount.toString()),
        })),
      });
    }
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
    const buffer =
      typeof data === 'string'
        ? Buffer.from(data.startsWith('0x') ? data.substring(2) : data, 'hex')
        : data;

    if (dataType === 'route') {
      // Decode route using Borsh
      const decoded = svmCoder.types.decode('Route', buffer) as Snakify<RouteInstruction> | null;

      if (decoded === null) {
        throw new Error('Unable to decode SVM route');
      }

      const route: Intent['route'] = {
        salt: bufferToBytes32(decoded.salt[0]),
        deadline: BigInt(decoded.deadline.toString()),
        portal: AddressNormalizer.normalizeSvm(bytes32ToAddress(decoded.portal[0])),
        nativeAmount: BigInt(decoded.native_amount.toString()), // Route doesn't have nativeAmount in the schema
        tokens: decoded.tokens.map((t) => ({
          token: AddressNormalizer.normalizeSvm(t.token),
          amount: BigInt(t.amount.toString()),
        })),
        calls: decoded.calls.map((c) => ({
          target: AddressNormalizer.normalizeSvm(bytes32ToAddress(c.target[0])),
          data: bufferToBytes32(c.data),
          value: 0n, // Value is not part of the Call struct
        })),
      };

      return route as Type extends 'route' ? Intent['route'] : Intent['reward'];
    }

    // Decode reward using Borsh
    const decoded = svmCoder.types.decode('Reward', buffer) as Snakify<RewardInstruction> | null;

    if (decoded === null) {
      throw new Error('Unable to decode SVM reward');
    }

    const reward: Intent['reward'] = {
      deadline: BigInt(decoded.deadline.toString()),
      creator: AddressNormalizer.normalizeSvm(decoded.creator),
      prover: AddressNormalizer.normalizeSvm(decoded.prover),
      nativeAmount: BigInt(decoded.native_amount.toString()),
      tokens: decoded.tokens.map((t) => ({
        token: AddressNormalizer.normalizeSvm(t.token),
        amount: BigInt(t.amount),
      })),
    };

    return reward as Type extends 'route' ? Intent['route'] : Intent['reward'];
  }
}
