/**
 * Portal Hash Utilities
 *
 * Provides hash calculation and vault derivation utilities for the Portal contract system.
 * Implements the content-addressable hashing scheme with chain-specific encoding.
 */

import { encodeAbiParameters, encodePacked, Hex, keccak256 } from 'viem'
import { IntentV2Pure, RewardV2, RouteV2, RouteV2Pure } from '@/contracts/v2-abi/Portal'
import { rewardStructAbiItem, routeStructAbiItem } from '@/contracts/v2-abi/Portal'
import { hashReward } from '@eco-foundation/routes-ts'

export enum ChainType {
  EVM = 'evm',
  TVM = 'tvm', // Tron Virtual Machine
  SVM = 'svm', // Solana Virtual Machine
}

export class PortalHashUtils {

  static encodeRoute(route: RouteV2Pure) {
    return encodeAbiParameters(
        [{ type: 'tuple', components: routeStructAbiItem }],
        [route],
    )
  }

  static hashRoute(route: RouteV2Pure) {
    return keccak256(this.encodeRoute(route))
  }

  /**
   * This replaces the hashIntent function from @eco-foundation/routes-ts
   *
   * Matches the contract's three overloaded versions:
   * 1. With Intent struct
   * 2. With destination, route (bytes), reward
   * 3. With destination, routeHash (bytes32), reward (core logic)
   *
   * @param intent - intent
   * @returns Object containing intentHash, routeHash, and rewardHash
   */
  static hashIntent(destination: bigint, route: RouteV2Pure, reward: RewardV2): {
    routeHash: Hex
    rewardHash: Hex
    intentHash: Hex
  } {
    const routeHash = this.hashRoute(route)
    const rewardHash = hashReward({...reward, nativeValue: reward.nativeAmount})
  
    const intentHash = keccak256(
      encodePacked(['uint64', 'bytes32', 'bytes32'], [destination, routeHash, rewardHash]),
    )
  
    return {
      routeHash,
      rewardHash,
      intentHash,
    }
  }
}
