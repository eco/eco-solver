/**
 * Portal Encoder Utility
 *
 * Provides chain-specific encoding and decoding for Portal contract data structures.
 * Each blockchain type (EVM, TVM, SVM) has its own encoding format:
 * - EVM: ABI encoding (hex)
 * - TVM: JSON with Base58 addresses
 * - SVM: Borsh serialization
 */

import { Address, decodeAbiParameters, encodeAbiParameters, Hex, parseAbiParameters } from 'viem';

import { EVMRewardAbiItem, EVMRouteAbiItem, Reward, Route } from '../abis/portal.abi';

import { ChainType } from './chain-type-detector';

export class PortalEncoder {
  /**
   * Encodes data for a specific chain type
   *
   * @param data - Data to encode (Route or Reward)
   * @param chainType - Target chain type
   * @returns Encoded data as Buffer
   */
  static encodeForChain(data: Route | Reward, chainType: ChainType): Buffer {
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
   * Decodes data from a specific chain type
   *
   * @param data - Encoded data as Buffer or string
   * @param chainType - Source chain type
   * @param dataType - Type of data ('route' or 'reward')
   * @returns Decoded Route or Reward object
   */
  static decodeFromChain<Type extends 'route' | 'reward'>(
    data: Buffer | string,
    chainType: ChainType,
    dataType: Type,
  ): Type extends 'route' ? Route : Reward {
    switch (chainType) {
      case ChainType.EVM:
      case ChainType.TVM:
        return this.decodeEvm(data, dataType);
      case ChainType.SVM:
        return this.decodeSvm(data, dataType);
      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  /**
   * EVM encoding using ABI parameters
   */
  private static encodeEvm(data: Route | Reward): Buffer {
    if (this.isRoute(data)) {
      const encoded = encodeAbiParameters(
        parseAbiParameters(
          '(bytes32,uint64,address,(address,uint256)[],(address,bytes,uint256)[])',
        ),
        [
          [
            data.salt,
            data.deadline,
            data.portal,
            data.tokens.map((t) => [t.token, t.amount]),
            data.calls.map((c) => [c.target, c.data, c.value]),
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
            data.creator,
            data.prover,
            data.nativeAmount,
            data.tokens.map((t) => [t.token, t.amount]),
          ],
        ],
      );
      return Buffer.from(encoded.slice(2), 'hex'); // Remove 0x prefix
    }
  }

  /**
   * TVM encoding using JSON with Base58 addresses
   */
  private static encodeTvm(data: Route | Reward): Buffer {
    if (this.isRoute(data)) {
      const tvmData = {
        salt: this.hexToBase58(data.salt),
        deadline: data.deadline.toString(),
        portal: this.addressToBase58(data.portal),
        tokens: data.tokens.map((t) => ({
          token: this.addressToBase58(t.token),
          amount: t.amount.toString(),
        })),
        calls: data.calls.map((c) => ({
          target: this.addressToBase58(c.target),
          data: this.hexToBase58(c.data),
          value: c.value.toString(),
        })),
      };
      return Buffer.from(JSON.stringify(tvmData), 'utf8');
    } else {
      const tvmData = {
        deadline: data.deadline.toString(),
        creator: this.addressToBase58(data.creator),
        prover: this.addressToBase58(data.prover),
        nativeAmount: data.nativeAmount.toString(),
        tokens: data.tokens.map((t) => ({
          token: this.addressToBase58(t.token),
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
  private static encodeSvm(data: Route | Reward): Buffer {
    if (this.isRoute(data)) {
      const svmData = {
        salt: Array.from(Buffer.from(data.salt.slice(2), 'hex')), // Convert hex to byte array
        deadline: data.deadline.toString(),
        portal: data.portal, // Keep as string for now
        tokens: data.tokens.map((t) => ({
          token: t.token,
          amount: t.amount.toString(),
        })),
        calls: data.calls.map((c) => ({
          target: c.target,
          data: Array.from(Buffer.from(c.data.slice(2), 'hex')),
          value: c.value.toString(),
        })),
      };
      return Buffer.from(JSON.stringify(svmData), 'utf8');
    } else {
      const svmData = {
        deadline: data.deadline.toString(),
        creator: data.creator,
        prover: data.prover,
        nativeAmount: data.nativeAmount.toString(),
        tokens: data.tokens.map((t) => ({
          token: t.token,
          amount: t.amount.toString(),
        })),
      };
      return Buffer.from(JSON.stringify(svmData), 'utf8');
    }
  }

  /**
   * EVM decoding (placeholder - would use viem's decodeAbiParameters)
   */
  private static decodeEvm<Type extends 'route' | 'reward'>(
    data: Buffer | string,
    dataType: Type,
  ): Type extends 'route' ? Route : Reward {
    const dataString = typeof data === 'string' ? data : '0x' + data.toString('hex');

    if (dataType === 'reward') {
      return decodeAbiParameters([EVMRewardAbiItem], dataString as Hex)[0] as Type extends 'route'
        ? Route
        : Reward;
    }
    return decodeAbiParameters([EVMRouteAbiItem], dataString as Hex)[0] as Type extends 'route'
      ? Route
      : Reward;
  }

  /**
   * SVM decoding from JSON
   */
  private static decodeSvm<Type extends 'route' | 'reward'>(
    data: Buffer | string,
    dataType: Type,
  ): Type extends 'route' ? Route : Reward {
    const jsonStr = typeof data === 'string' ? data : data.toString('utf8');
    const parsed = JSON.parse(jsonStr);

    if (dataType === 'route') {
      return {
        salt: ('0x' + Buffer.from(parsed.salt).toString('hex')) as Hex,
        deadline: BigInt(parsed.deadline),
        portal: parsed.portal as Address,
        nativeAmount: BigInt(parsed.nativeAmount),
        tokens: parsed.tokens.map((t: any) => ({
          token: t.token as Address,
          amount: BigInt(t.amount),
        })),
        calls: parsed.calls.map((c: any) => ({
          target: c.target as Address,
          data: ('0x' + Buffer.from(c.data).toString('hex')) as Hex,
          value: BigInt(c.value),
        })),
      } as Type extends 'route' ? Route : Reward;
    }

    return {
      deadline: BigInt(parsed.deadline),
      creator: parsed.creator as Address,
      prover: parsed.prover as Address,
      nativeAmount: BigInt(parsed.nativeAmount),
      tokens: parsed.tokens.map((t: any) => ({
        token: t.token as Address,
        amount: BigInt(t.amount),
      })),
    } as Type extends 'route' ? Route : Reward;
  }

  // Helper methods for address format conversion
  private static hexToBase58(hex: Hex): string {
    // Placeholder implementation
    // In production, use proper base58 encoding library
    return `base58_${hex}`;
  }

  private static addressToBase58(address: Address): string {
    // Placeholder implementation
    // In production, convert EVM address to Tron Base58 format
    return `T${address.slice(2, 34)}`;
  }

  /**
   * Type guard to determine if data is a Route
   */
  private static isRoute(data: Route | Reward): data is Route {
    return 'salt' in data && 'portal' in data && 'calls' in data;
  }
}
