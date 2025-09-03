/**
 * Portal Hash Utilities
 *
 * Provides hash calculation and vault derivation utilities for the Portal contract system.
 * Implements the content-addressable hashing scheme with chain-specific encoding.
 */

import { encodeAbiParameters, encodePacked, Hex, keccak256 } from 'viem';

import { toRewardEVMIntent, toRouteEVMIntent } from '@/common/utils/intent-converter';

import { EVMRewardAbiItem, EVMRouteAbiItem } from '../abis/portal.abi';
import { Intent } from '../interfaces/intent.interface';

export class PortalHashUtils {
  static getIntentHash(intent: Intent): { intentHash: Hex; routeHash: Hex; rewardHash: Hex } {
    const routeHash = PortalHashUtils.computeRouteHash(intent.route);
    const rewardHash = PortalHashUtils.computeRewardHash(intent.reward);

    // Compute the intent hash using encodePacked
    // intentHash = keccak256(abi.encodePacked(destination, routeHash, rewardHash))
    const intentHash = keccak256(
      encodePacked(['uint64', 'bytes32', 'bytes32'], [intent.destination, routeHash, rewardHash]),
    );

    return {
      intentHash,
      routeHash,
      rewardHash,
    };
  }

  /**
   * Computes route hash using source chain encoding
   * Accepts both Intent route (with UniversalAddress) and EVMIntent route
   *
   * @param route - Route data structure
   * @returns Route hash as Hex
   */
  static computeRouteHash(route: Intent['route']): Hex {
    return keccak256(encodeAbiParameters([EVMRouteAbiItem], [toRouteEVMIntent(route)]));
  }

  /**
   * Computes reward hash using source chain encoding
   * Accepts both Intent reward (with UniversalAddress) and EVMIntent reward
   *
   * @param reward - Reward data structure
   * @returns Reward hash as Hex
   */
  static computeRewardHash(reward: Intent['reward']): Hex {
    return keccak256(encodeAbiParameters([EVMRewardAbiItem], [toRewardEVMIntent(reward)]));
  }
}
