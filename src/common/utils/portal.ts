/**
 * Portal Hash Utilities
 *
 * Provides hash calculation and vault derivation utilities for the Portal contract system.
 * Implements the content-addressable hashing scheme with chain-specific encoding.
 */

import { encodeAbiParameters, encodePacked, Hex, keccak256 } from 'viem'
import { IntentV2Pure } from '@/contracts/v2-abi/Portal'
import { rewardStructAbiItem, routeStructAbiItem } from '@/contracts'

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
  static getIntentHash(intent: IntentV2Pure): { intentHash: Hex; routeHash: Hex; rewardHash: Hex } {
    const { destination, reward, route } = intent

    const encodedRoute = encodeAbiParameters([routeStructAbiItem], [route])
    const routeHash = keccak256(encodedRoute)

    // Encode and hash the reward
    const encodedReward = encodeAbiParameters([rewardStructAbiItem], [reward])
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
}
