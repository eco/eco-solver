/**
 * Portal Encoder Utility
 *
 * Provides chain-specific encoding and decoding for Portal contract data structures.
 * Each blockchain type (EVM, TVM, SVM) has its own encoding format:
 * - EVM: ABI encoding (hex)
 * - TVM: ABI encoding (hex)
 * - SVM: Borsh serialization
 */

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
            data.tokens.map((t) => [AddressNormalizer.denormalizeToEvm(t.token), t.amount]),
            data.calls.map((c) => [AddressNormalizer.denormalizeToEvm(c.target), c.data, c.value]),
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
            data.tokens.map((t) => [AddressNormalizer.denormalizeToEvm(t.token), t.amount]),
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
   * SVM encoding using simplified JSON (Borsh would require more complex setup)
   * In production, this should use Borsh serialization
   */
  private static encodeSvm(data: Intent['route'] | Intent['reward']): Buffer {
    if (this.isRoute(data)) {
      const svmData = {
        salt: Array.from(Buffer.from(data.salt.slice(2), 'hex')), // Convert hex to byte array
        deadline: data.deadline.toString(),
        portal: AddressNormalizer.denormalize(data.portal, ChainType.SVM),
        tokens: data.tokens.map((t) => ({
          token: AddressNormalizer.denormalize(t.token, ChainType.SVM),
          amount: t.amount.toString(),
        })),
        calls: data.calls.map((c) => ({
          target: AddressNormalizer.denormalize(c.target, ChainType.SVM),
          data: Array.from(Buffer.from(c.data.slice(2), 'hex')),
          value: c.value.toString(),
        })),
      };
      return Buffer.from(JSON.stringify(svmData), 'utf8');
    } else {
      const svmData = {
        deadline: data.deadline.toString(),
        creator: AddressNormalizer.denormalize(data.creator, ChainType.SVM),
        prover: AddressNormalizer.denormalize(data.prover, ChainType.SVM),
        nativeAmount: data.nativeAmount.toString(),
        tokens: data.tokens.map((t) => ({
          token: AddressNormalizer.denormalize(t.token, ChainType.SVM),
          amount: t.amount.toString(),
        })),
      };
      return Buffer.from(JSON.stringify(svmData), 'utf8');
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
   * SVM decoding from JSON to Intent format
   */
  private static decodeSvm<Type extends 'route' | 'reward'>(
    data: Buffer | string,
    dataType: Type,
  ): Type extends 'route' ? Intent['route'] : Intent['reward'] {
    const jsonStr = typeof data === 'string' ? data : data.toString('utf8');
    const parsed = JSON.parse(jsonStr);

    if (dataType === 'route') {
      return {
        salt: ('0x' + Buffer.from(parsed.salt).toString('hex')) as Hex,
        deadline: BigInt(parsed.deadline),
        portal: AddressNormalizer.normalize(parsed.portal, ChainType.SVM),
        nativeAmount: BigInt(parsed.nativeAmount || '0'),
        tokens: parsed.tokens.map((t: any) => ({
          token: AddressNormalizer.normalize(t.token, ChainType.SVM),
          amount: BigInt(t.amount),
        })),
        calls: parsed.calls.map((c: any) => ({
          target: AddressNormalizer.normalize(c.target, ChainType.SVM),
          data: ('0x' + Buffer.from(c.data).toString('hex')) as Hex,
          value: BigInt(c.value),
        })),
      } as Type extends 'route' ? Intent['route'] : Intent['reward'];
    }

    return {
      deadline: BigInt(parsed.deadline),
      creator: AddressNormalizer.normalize(parsed.creator, ChainType.SVM),
      prover: AddressNormalizer.normalize(parsed.prover, ChainType.SVM),
      nativeAmount: BigInt(parsed.nativeAmount),
      tokens: parsed.tokens.map((t: any) => ({
        token: AddressNormalizer.normalize(t.token, ChainType.SVM),
        amount: BigInt(t.amount),
      })),
    } as Type extends 'route' ? Intent['route'] : Intent['reward'];
  }

  /**
   * Type guard to determine if data is a Route
   */
  private static isRoute(data: Intent['route'] | Intent['reward']): data is Intent['route'] {
    return 'salt' in data && 'portal' in data && 'calls' in data;
  }
}
