/**
 * Portal Hash Utilities
 *
 * Provides hash calculation and vault derivation utilities for the Portal contract system.
 * Implements the content-addressable hashing scheme with chain-specific encoding.
 */

import { encodeAbiParameters, encodePacked, Hex, keccak256 } from 'viem';

import { toEVMIntent } from '@/common/utils/intent-converter';

import { EVMRewardAbiItem, EVMRouteAbiItem } from '../abis/portal.abi';
import { Intent } from '../interfaces/intent.interface';

import { ChainType } from './chain-type-detector';
import { PortalEncoder } from './portal-encoder';

export class PortalHashUtils {
  static getIntentHash(intent: Intent): { intentHash: Hex; routeHash: Hex; rewardHash: Hex } {
    const { destination, reward, route } = toEVMIntent(intent);

    const encodedRoute = encodeAbiParameters([EVMRouteAbiItem], [route]);
    const routeHash = keccak256(encodedRoute);

    // Encode and hash the reward
    const encodedReward = encodeAbiParameters([EVMRewardAbiItem], [reward]);
    const rewardHash = keccak256(encodedReward);

    // Compute final intent hash using encodePacked
    // intentHash = keccak256(abi.encodePacked(destination, routeHash, rewardHash))
    const intentHash = keccak256(
      encodePacked(['uint64', 'bytes32', 'bytes32'], [destination, routeHash, rewardHash]),
    );

    return {
      intentHash,
      routeHash,
      rewardHash,
    };
  }

  /**
   * Computes reward hash using source chain encoding
   * Accepts both Intent reward (with UniversalAddress) and EVMIntent reward
   *
   * @param reward - Reward data structure
   * @param chainType - Source chain type for encoding
   * @returns Reward hash as Hex
   */
  static computeRewardHash(reward: Intent['reward'], chainType: ChainType): Hex {
    const encoded = PortalEncoder.encodeForChain(reward, chainType);
    return keccak256(`0x${encoded.toString('hex')}`);
  }
}
