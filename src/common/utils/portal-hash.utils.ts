/**
 * Portal Hash Utilities
 *
 * Provides hash calculation and vault derivation utilities for the Portal contract system.
 * Implements the content-addressable hashing scheme with chain-specific encoding.
 */

import { BN, BorshCoder } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { encodeAbiParameters, encodePacked, Hex, keccak256 } from 'viem';

import { toRewardEVMIntent, toRouteEVMIntent } from '@/common/utils/intent-converter';
import { portalIdl } from '@/modules/blockchain/svm/targets/idl/portal.idl';

import { EVMRewardAbiItem, EVMRouteAbiItem } from '../abis/portal.abi';
import { Intent } from '../interfaces/intent.interface';

import { AddressNormalizer } from './address-normalizer';
import { ChainType, ChainTypeDetector } from './chain-type-detector';

const svmCoder = new BorshCoder(portalIdl);

export class PortalHashUtils {
  static getIntentHash(intent: Intent): { intentHash: Hex; routeHash: Hex; rewardHash: Hex } {
    const routeHash = PortalHashUtils.computeRouteHash(intent.route);
    const rewardHash = PortalHashUtils.computeRewardHash(intent.reward, intent.sourceChainId);

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
   * Accepts both Intent reward (with UniversalAddress)
   *
   * @param reward - Reward data structure
   * @param sourceChainId - Source chain ID to determine encoding type
   * @returns Reward hash as Hex
   */
  static computeRewardHash(reward: Intent['reward'], sourceChainId: bigint): Hex {
    // Detect chain type from source chain ID
    const chainType = ChainTypeDetector.detect(sourceChainId);

    switch (chainType) {
      case ChainType.SVM: {
        return PortalHashUtils.computeRewardHashSvm(reward);
      }
      case ChainType.EVM:
      case ChainType.TVM:
        return PortalHashUtils.computeRewardHashEvm(reward);
      default:
        throw new Error(
          `Unsupported chain type: ${chainType} for source chain ID: ${sourceChainId}`,
        );
    }
  }

  private static computeRewardHashSvm(reward: Intent['reward']): Hex {
    const { deadline, creator, prover, nativeAmount, tokens } = reward;

    // Convert universal addresses to SVM-specific (base58) addresses
    const creatorSvm = AddressNormalizer.denormalize(creator, ChainType.SVM);
    const proverSvm = AddressNormalizer.denormalize(prover, ChainType.SVM);

    const encoded = svmCoder.types.encode('Reward', {
      deadline: new BN(deadline.toString()),
      creator: new PublicKey(creatorSvm),
      prover: new PublicKey(proverSvm),
      native_amount: new BN(nativeAmount.toString()),
      tokens: tokens.map(({ token, amount }) => ({
        token: new PublicKey(AddressNormalizer.denormalize(token, ChainType.SVM)),
        amount: new BN(amount.toString()),
      })),
    });

    // Hash the encoded data to get a consistent 32-byte hash like EVM/TVM cases
    return keccak256(`0x${encoded.toString('hex')}` as Hex);
  }

  private static computeRewardHashEvm(reward: Intent['reward']): Hex {
    return keccak256(encodeAbiParameters([EVMRewardAbiItem], [toRewardEVMIntent(reward)]));
  }
}
