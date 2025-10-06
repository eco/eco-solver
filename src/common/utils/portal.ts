/**
 * Portal Hash Utilities
 *
 * Provides hash calculation and vault derivation utilities for the Portal contract system.
 * Implements the content-addressable hashing scheme with chain-specific encoding.
 */

import { encodeAbiParameters, encodePacked, Hex, keccak256 } from 'viem'
import { IntentV2Pure } from '@/contracts/v2-abi/Portal'
import { rewardStructAbiItem, routeStructAbiItem } from '@/contracts'
import { EcoLogger } from '../logging/eco-logger'
import { EcoLogMessage } from '../logging/eco-log-message'

export enum ChainType {
  EVM = 'evm',
  TVM = 'tvm', // Tron Virtual Machine
  SVM = 'svm', // Solana Virtual Machine
}

export class PortalHashUtils {
  /**
   * Recreates the getIntentHash function from IntentSource contract using Viem
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
  static getIntentHash(
    intent: IntentV2Pure,
    logger?: EcoLogger,
  ): { intentHash: Hex; routeHash: Hex; rewardHash: Hex } {
    const { destination, reward, route } = intent

    const encodedRoute = PortalHashUtils.getEncodedRoute(route)
    const routeHash = keccak256(encodedRoute)

    logger?.debug(
      EcoLogMessage.fromDefault({
        message: `getIntentHash: encodedRoute`,
        properties: { encodedRoute },
      }),
    )

    // Encode and hash the reward
    const encodedReward = encodeAbiParameters([rewardStructAbiItem], [reward])

    logger?.debug(
      EcoLogMessage.fromDefault({
        message: `getIntentHash: encodedReward`,
        properties: { encodedReward },
      }),
    )

    const rewardHash = keccak256(encodedReward)

    // Compute the final intent hash using encodePacked
    // intentHash = keccak256(abi.encodePacked(destination, routeHash, rewardHash))
    const intentHash = keccak256(
      encodePacked(['uint64', 'bytes32', 'bytes32'], [destination, routeHash, rewardHash]),
    )

    return {
      intentHash,
      routeHash,
      rewardHash,
    }
  }

  static getEncodedRoute(route: IntentV2Pure['route']) {
    return encodeAbiParameters([routeStructAbiItem], [route])
  }
}
