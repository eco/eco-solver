/**
 * Portal Hash Utilities
 *
 * Provides hash calculation and vault derivation utilities for the Portal contract system.
 * Implements the content-addressable hashing scheme with chain-specific encoding.
 */

import { PublicKey } from '@solana/web3.js';
import {
  Address,
  encodeAbiParameters,
  encodePacked,
  Hex,
  keccak256,
  parseAbiParameters,
} from 'viem';

import { TvmUtilsService } from '@/modules/blockchain/tvm/services/tvm-utils.service';

import {
  EVMRewardAbiItem,
  EVMRouteAbiItem,
  PortalIntent,
  Reward,
  Route,
  VAULT_IMPLEMENTATION_BYTECODE_HASH,
} from '../abis/portal.abi';

import { ChainType } from './chain-type-detector';
import { PortalEncoder } from './portal-encoder';

export class PortalHashUtils {
  /**
   * Recreates the getIntentHash function from IntentSource contract using Viem
   *
   * Matches the contract's three overloaded versions:
   * 1. With Intent struct
   * 2. With destination, route (bytes), reward
   * 3. With destination, routeHash (bytes32), reward (core logic)
   *
   * @param intentOrDestination - Either a full PortalIntent or destination chain ID
   * @param routeOrRouteHash - Either route data (Route object or bytes) or route hash
   * @param reward - Reward structure (optional if first param is PortalIntent)
   * @returns Object containing intentHash, routeHash, and rewardHash
   */
  static getIntentHash(
    intentOrDestination: PortalIntent | bigint,
    routeOrRouteHash?: Route | Hex,
    reward?: Reward,
  ): { intentHash: Hex; routeHash: Hex; rewardHash: Hex } {
    // Handle first overload: getIntentHash(Intent memory intent)
    if (typeof intentOrDestination === 'object' && 'destination' in intentOrDestination) {
      const intent = intentOrDestination as PortalIntent;
      return this.getIntentHash(intent.destination, intent.route, intent.reward);
    }

    // Handle second and third overloads
    const destination = intentOrDestination as bigint;

    if (!routeOrRouteHash || !reward) {
      throw new Error('Route and reward are required when destination is provided');
    }

    let routeHash: Hex;

    // Check if routeOrRouteHash is already a hash (Hex string starting with 0x)
    if (typeof routeOrRouteHash === 'string' && routeOrRouteHash.startsWith('0x')) {
      // Third overload: destination, routeHash (bytes32), reward
      routeHash = routeOrRouteHash as Hex;
    } else {
      // Second overload: destination, route (Route object or bytes), reward
      // Encode the route and hash it
      const route = routeOrRouteHash as Route;
      const encodedRoute = encodeAbiParameters([EVMRouteAbiItem], [route]);
      routeHash = keccak256(encodedRoute);
    }

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
   * Computes the complete intent hash using Portal's hash-based reference system
   *
   * Critical: Routes use destination chain encoding, rewards use source chain encoding
   * intentHash = keccak256(destination || routeHash || rewardHash)
   *
   * @param destination - Target chain ID
   * @param route - Route data structure
   * @param reward - Reward data structure
   * @param sourceChainType - Source chain type for reward encoding
   * @param destChainType - Destination chain type for route encoding
   * @returns Intent hash as Hex
   */
  static computeIntentHash(
    destination: bigint,
    route: Route,
    reward: Reward,
    sourceChainType: ChainType,
    destChainType: ChainType,
  ): Hex {
    const routeHash = this.computeRouteHash(route, destChainType);
    const rewardHash = this.computeRewardHash(reward, sourceChainType);

    // Encode: destination (uint64) || routeHash (bytes32) || rewardHash (bytes32)
    const encoded = encodeAbiParameters(parseAbiParameters('uint64, bytes32, bytes32'), [
      destination,
      routeHash,
      rewardHash,
    ]);

    return keccak256(encoded);
  }

  /**
   * Computes route hash using destination chain encoding
   *
   * @param route - Route data structure
   * @param chainType - Destination chain type for encoding
   * @returns Route hash as Hex
   */
  static computeRouteHash(route: Route, chainType: ChainType): Hex {
    const encoded = PortalEncoder.encodeForChain(route, chainType);
    return keccak256(`0x${encoded.toString('hex')}`);
  }

  /**
   * Computes reward hash using source chain encoding
   *
   * @param reward - Reward data structure
   * @param chainType - Source chain type for encoding
   * @returns Reward hash as Hex
   */
  static computeRewardHash(reward: Reward, chainType: ChainType): Hex {
    const encoded = PortalEncoder.encodeForChain(reward, chainType);
    return keccak256(`0x${encoded.toString('hex')}`);
  }

  /**
   * Derives vault address for EVM chains using CREATE2
   *
   * EVM Vault Formula:
   * vault = create2(PortalAddress, intentHash, VaultImplementation)
   *
   * @param portalAddress - Portal contract address
   * @param intentHash - Intent hash as salt
   * @returns Vault address
   */
  static deriveVaultAddress(portalAddress: Address, intentHash: Hex): Address {
    // CREATE2 address calculation: keccak256(0xff ++ deployer ++ salt ++ bytecodeHash)[12:]
    const packed = encodeAbiParameters(parseAbiParameters('bytes1, address, bytes32, bytes32'), [
      '0xff',
      portalAddress,
      intentHash,
      VAULT_IMPLEMENTATION_BYTECODE_HASH,
    ]);

    const hash = keccak256(packed);
    // Take last 20 bytes (40 hex characters) for address
    return `0x${hash.slice(26)}` as Address;
  }

  /**
   * Derives vault PDA (Program Derived Address) for Solana
   *
   * Solana Vault Formula:
   * vault = PDA([b"vault", intentHash], PortalProgramID)
   *
   * @param intentHash - Intent hash as Buffer
   * @param portalProgramId - Portal program public key (required)
   * @returns Vault PDA
   */
  static deriveVaultPDA(intentHash: Buffer, portalProgramId?: PublicKey): PublicKey {
    if (!portalProgramId) {
      throw new Error('Portal program ID is required for deriving vault PDA');
    }

    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), intentHash],
      portalProgramId,
    );

    return vaultPDA;
  }

  /**
   * Derives vault address for TVM (Tron) chains
   * Note: This is a placeholder - actual Tron vault derivation may differ
   *
   * @param portalAddress - Portal contract address (Base58)
   * @param intentHash - Intent hash
   * @returns Vault address in Tron format
   */
  static deriveVaultAddressTvm(portalAddress: string, intentHash: Hex): string {
    // Placeholder implementation
    // In production, this should use Tron's address derivation mechanism
    const hash = keccak256(
      encodeAbiParameters(parseAbiParameters('string, bytes32'), [portalAddress, intentHash]),
    );

    // Convert to Tron Base58 format (placeholder)
    return `TVault${hash.slice(2, 32)}`;
  }

  /**
   * Gets vault address for any chain type
   *
   * @param chainType - Chain type
   * @param chainId - Chain identifier
   * @param intentHash - Intent hash
   * @param portalAddress - Portal contract address for the chain
   * @returns Vault address as string
   */
  static getVaultAddress(
    chainType: ChainType,
    chainId: string | number | bigint,
    intentHash: Hex,
    portalAddress: string,
  ): string {
    switch (chainType) {
      case ChainType.EVM: {
        if (!portalAddress) {
          throw new Error(`No Portal address provided for EVM chain ${chainId}`);
        }
        return this.deriveVaultAddress(portalAddress as Address, intentHash);
      }

      case ChainType.SVM: {
        const intentHashBuffer = Buffer.from(intentHash.slice(2), 'hex');
        // For SVM, use the provided portal address if it's a valid PublicKey
        const programId = portalAddress ? new PublicKey(portalAddress) : undefined;
        const vaultPDA = this.deriveVaultPDA(intentHashBuffer, programId);
        return vaultPDA.toString();
      }

      case ChainType.TVM: {
        if (!portalAddress) {
          throw new Error(`No Portal address provided for TVM chain ${chainId}`);
        }
        return this.deriveVaultAddressTvm(portalAddress, intentHash);
      }

      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  /**
   * Validates that a portal address matches the expected address for a chain
   *
   * @param portalAddress - Portal address to validate
   * @param expectedAddress - Expected portal address for the chain
   * @param chainType - Chain type for comparison logic
   * @returns true if address matches expected Portal address
   */
  static validatePortalAddress(
    portalAddress: string,
    expectedAddress: string,
    chainType: ChainType,
  ): boolean {
    if (!expectedAddress) {
      return false;
    }

    // Case-insensitive comparison for EVM addresses
    if (chainType === ChainType.EVM) {
      return portalAddress.toLowerCase() === expectedAddress.toLowerCase();
    }

    // TVM addresses can be in either Hex or Base58 format
    if (chainType === ChainType.TVM) {
      // Normalize both addresses to Base58 format for comparison
      const normalizedPortal = TvmUtilsService.normalizeAddressToBase58(portalAddress);
      const normalizedExpected = TvmUtilsService.normalizeAddressToBase58(expectedAddress);
      return normalizedPortal === normalizedExpected;
    }

    // Exact match for other chains
    return portalAddress === expectedAddress;
  }

  /**
   * Checks if an address is a valid vault address for the given intent
   *
   * @param address - Address to check
   * @param chainType - Chain type
   * @param chainId - Chain identifier
   * @param intentHash - Intent hash
   * @param portalAddress - Portal contract address for the chain
   * @returns true if address is the correct vault for the intent
   */
  static isValidVaultAddress(
    address: string,
    chainType: ChainType,
    chainId: string | number | bigint,
    intentHash: Hex,
    portalAddress: string,
  ): boolean {
    try {
      const expectedVault = this.getVaultAddress(chainType, chainId, intentHash, portalAddress);

      // Case-insensitive comparison for EVM
      if (chainType === ChainType.EVM) {
        return address.toLowerCase() === expectedVault.toLowerCase();
      }

      // Exact match for other chains
      return address === expectedVault;
    } catch {
      return false;
    }
  }
}
