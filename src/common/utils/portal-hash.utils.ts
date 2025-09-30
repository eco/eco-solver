/**
 * Portal Hash Utilities
 *
 * Provides hash calculation and vault derivation utilities for the Portal contract system.
 * Implements the content-addressable hashing scheme with chain-specific encoding.
 */

import { encodePacked, Hex, keccak256 } from 'viem';

import { PortalEncoder } from '@/common/utils/portal-encoder';

import { Intent } from '../interfaces/intent.interface';

import { ChainTypeDetector } from './chain-type-detector';

export class PortalHashUtils {
  static getIntentHash(intent: Intent): { intentHash: Hex; routeHash: Hex; rewardHash: Hex };
  static getIntentHash(destination: bigint, routeHash: Hex, rewardHash: Hex): { intentHash: Hex; routeHash: Hex; rewardHash: Hex };
  
  
  static getIntentHash(
    intentOrDestination: Intent | bigint,
    routeHash?: Hex,
    rewardHash?: Hex,
  ): { intentHash: Hex; routeHash: Hex; rewardHash: Hex } {
    let destination: bigint;
    let computedRouteHash: Hex;
    let computedRewardHash: Hex;

    if (typeof intentOrDestination === 'object') {
      const intent = intentOrDestination;
      destination = intent.destination;
      computedRouteHash = PortalHashUtils.computeRouteHash(intent.route, intent.destination);
      computedRewardHash = PortalHashUtils.computeRewardHash(intent.reward, intent.sourceChainId);
    } else {
      destination = intentOrDestination;
      computedRouteHash = routeHash!;
      computedRewardHash = rewardHash!;
    }

    // Compute the intent hash using encodePacked
    // intentHash = keccak256(abi.encodePacked(destination, routeHash, rewardHash))
    const intentHash = keccak256(
      encodePacked(['uint64', 'bytes32', 'bytes32'], [destination, computedRouteHash, computedRewardHash]),
    );

    return {
      intentHash,
      routeHash: computedRouteHash,
      rewardHash: computedRewardHash,
    };
  }

  /**
   * Computes route hash using source chain encoding
   * Accepts both Intent route (with UniversalAddress) and EVMIntent route
   *
   * @param route - Route data structure
   * @param destination - Destination chain id
   * @returns Route hash as Hex
   */
  static computeRouteHash(route: Intent['route'], destination: bigint): Hex {
    const chainType = ChainTypeDetector.detect(destination);
    const routeEncoded = PortalEncoder.encode(route, chainType);
    return keccak256(routeEncoded);
  }

  /**
   * Computes reward hash using source chain encoding
   * Accepts both Intent reward (with UniversalAddress)
   *
   * @param reward - Reward data structure
   * @param sourceChainId - Source chain ID to determine encoding type
   * @returns Reward hash as Hex
   */
  static computeRewardHash(reward: Intent['reward'], sourceChainId: bigint): Hex {
    const chainType = ChainTypeDetector.detect(sourceChainId);
    const rewardEncoded = PortalEncoder.encode(reward, chainType);
    return keccak256(rewardEncoded);
  }
}
