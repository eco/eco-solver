import { concat, encodeAbiParameters, encodePacked, Hex, keccak256, pad, toBytes } from 'viem';

import { EcoResponse } from '@/common/eco-response';
import { EcoLogger } from '@/common/logging/eco-logger';
import { EcoError } from '@/errors/eco-error';

// Types matching latest Permit3 specification
export interface AllowanceOrTransfer {
  modeOrExpiration: number; // uint48
  tokenKey: Hex; // bytes32 - encoded token identifier
  account: Hex; // address
  amountDelta: bigint; // uint160
}

export interface ChainPermits {
  chainId: bigint;
  permits: AllowanceOrTransfer[];
}

export interface MerkleProofData {
  proof: Hex[]; // Standard merkle proof for OpenZeppelin
  root: Hex; // Merkle root
  leaf: Hex; // Leaf hash being proven
}

export interface MerkleTree {
  root: Hex;
  proofs: Map<number, Hex[]>;
  leaves: Hex[];
}

export interface MerkleTreeResult {
  tree: MerkleTree;
  root: Hex;
  proofs: Map<bigint, MerkleProofData>;
  leafByChainId: Map<bigint, Hex>;
}

export interface CrossChainProofData {
  permits: AllowanceOrTransfer[];
  leaf: Hex;
  proof: Hex[];
}

export interface CrossChainProofs {
  merkleRoot: Hex;
  proofsByChainId: Map<bigint, CrossChainProofData>;
}

// Standard Merkle Builder for latest Permit3 specification
// Compatible with OpenZeppelin's MerkleProof.processProof()
export class StandardMerkleBuilder {
  private logger = new EcoLogger(StandardMerkleBuilder.name);

  // EIP-712 typehash matching latest Permit3 contract
  private readonly CHAIN_PERMITS_TYPEHASH = keccak256(
    toBytes(
      // eslint-disable-next-line max-len
      'ChainPermits(uint64 chainId,AllowanceOrTransfer[] permits)AllowanceOrTransfer(uint48 modeOrExpiration,bytes32 tokenKey,address account,uint160 amountDelta)',
    ),
  );

  createMerkleTree(
    permitsByChain: Record<number, AllowanceOrTransfer[]>,
  ): EcoResponse<MerkleTreeResult> {
    try {
      // 1. Deterministic ordering by chainId
      const sortedEntries = Object.entries(permitsByChain)
        .filter(([, permits]) => permits.length > 0)
        .sort((a, b) => Number(a[0]) - Number(b[0]));

      if (sortedEntries.length === 0) {
        return { error: new Error('No permits provided') };
      }

      // 2. Compute leaves
      const leaves: Hex[] = [];
      const leafByChainId = new Map<bigint, Hex>();
      const chainIds: bigint[] = [];

      for (const [chainIdStr, permits] of sortedEntries) {
        const chainId = BigInt(chainIdStr);
        const leaf = this.hashChainPermits(chainId, permits);

        leaves.push(leaf);
        chainIds.push(chainId);
        leafByChainId.set(chainId, leaf);
      }

      // 3. Build Merkle tree with proofs
      const { response: tree, error } = this.buildMerkleTree(leaves);

      if (error) {
        return { error };
      }

      const { root, proofs } = tree!;

      const proofsMap = new Map<bigint, MerkleProofData>();
      chainIds.forEach((chainId, idx) => {
        proofsMap.set(chainId, {
          root,
          proof: proofs.get(idx)!,
          leaf: leaves[idx],
        });
      });

      const result: MerkleTreeResult = {
        tree: tree!,
        root,
        proofs: proofsMap,
        leafByChainId,
      };

      return { response: result };
    } catch (ex: any) {
      EcoError.logErrorWithStack(ex.message, `createMerkleTree: exception`, this.logger);
      return { error: EcoError.MerkleTreeCreateError };
    }
  }

  /**
   * Hash a single AllowanceOrTransfer struct according to EIP-712
   */
  private hashAllowanceOrTransfer(permit: AllowanceOrTransfer): Hex {
    return keccak256(
      encodeAbiParameters(
        [
          { type: 'uint48' },
          { type: 'bytes32' }, // Changed from address to bytes32
          { type: 'address' },
          { type: 'uint160' },
        ],
        [
          permit.modeOrExpiration,
          permit.tokenKey, // Changed from token to tokenKey
          permit.account,
          permit.amountDelta,
        ],
      ),
    );
  }

  /**
   * Hash chain permits according to EIP-712 for a specific chain
   * This creates the leaf value for the merkle tree
   */
  private hashChainPermits(chainId: bigint, permits: AllowanceOrTransfer[]): Hex {
    const permitHashes = permits.map((permit) => this.hashAllowanceOrTransfer(permit));

    // Flat concat — no ABI-encoding of dynamic array
    const permitsArrayHash = keccak256(concat(permitHashes));

    // Create the final chain permits hash
    return keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'uint64' }, { type: 'bytes32' }],
        [this.CHAIN_PERMITS_TYPEHASH, chainId, permitsArrayHash],
      ),
    );
  }

  /**
   * Get merkle proof for a specific chain
   */
  getProofForChain(
    chainId: bigint,
    permitsByChain: Record<number, AllowanceOrTransfer[]>,
  ): EcoResponse<MerkleProofData> {
    const { response: treeResult, error } = this.createMerkleTree(permitsByChain);

    if (error) {
      return { error };
    }

    const { proofs } = treeResult!;
    const proofData = proofs.get(chainId);

    if (!proofData) {
      return { error: new Error(`No proof found for chainId ${chainId}`) };
    }

    return { response: proofData };
  }

  /**
   * Create merkle tree and proofs for cross-chain permits
   * This is the main method for cross-chain permit operations
   */
  createCrossChainProofs(
    permitsByChain: Record<number, AllowanceOrTransfer[]>,
  ): EcoResponse<CrossChainProofs> {
    const { response: treeResult, error } = this.createMerkleTree(permitsByChain);

    if (error) {
      return { error };
    }

    const { root, proofs } = treeResult!;
    const proofsByChainId = new Map<bigint, CrossChainProofData>();

    for (const [chainIdStr, permits] of Object.entries(permitsByChain)) {
      const chainId = BigInt(chainIdStr);
      const proofData = proofs.get(chainId);

      if (!proofData) {
        return { error: EcoError.CrossChainProofsError };
      }

      proofsByChainId.set(chainId, {
        permits,
        leaf: proofData.leaf,
        proof: proofData.proof,
      });
    }

    return {
      response: {
        merkleRoot: root,
        proofsByChainId,
      },
    };
  }

  /**
   * Combine two nodes, sorting them lexicographically first.
   * Matches OZ's MerkleProof.processProof.
   */
  private combine(a: Hex, b: Hex): Hex {
    return keccak256(encodePacked(['bytes32', 'bytes32'], [a < b ? a : b, a < b ? b : a]));
  }

  /**
   * Build a Merkle tree with proofs for each leaf.
   * @param leaves array of leaf hashes
   */
  private buildMerkleTree(leaves: Hex[]): EcoResponse<MerkleTree> {
    if (leaves.length === 0) {
      return { error: EcoError.MerkleTreeCreateError };
    }

    // Start with leaf layer
    let level: Hex[] = [...leaves];
    const layers: Hex[][] = [level];

    // Build tree upward
    while (level.length > 1) {
      const nextLevel: Hex[] = [];
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 === level.length) {
          // Odd number: carry forward last node
          nextLevel.push(level[i]);
        } else {
          nextLevel.push(this.combine(level[i], level[i + 1]));
        }
      }
      level = nextLevel;
      layers.push(level);
    }

    const root = level[0];

    // Build proofs for each leaf
    const proofs = new Map<number, Hex[]>();
    leaves.forEach((_, leafIndex) => {
      const proof: Hex[] = [];
      let idx = leafIndex;

      for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex++) {
        const layer = layers[layerIndex];
        const isRightNode = idx % 2;
        const pairIndex = isRightNode ? idx - 1 : idx + 1;

        if (pairIndex < layer.length) {
          proof.push(layer[pairIndex]);
        }

        idx = Math.floor(idx / 2);
      }

      proofs.set(leafIndex, proof);
    });

    return {
      response: {
        root,
        proofs,
        leaves,
      },
    };
  }

  /**
   * Verifies a Merkle proof against a given root.
   * Mirrors OpenZeppelin's MerkleProof.processProof (sorted pairs).
   *
   * @param leaf   Leaf hash (chain-specific hash)
   * @param proof  Array of sibling nodes
   * @param root   Expected Merkle root
   * @returns true if the proof reconstructs the root
   */
  verifyProof(leaf: Hex, proof: Hex[], root: Hex): boolean {
    try {
      let computedHash = leaf;

      for (const proofElement of proof) {
        // Sort the pair to ensure consistency with OZ
        if (BigInt(computedHash) < BigInt(proofElement)) {
          computedHash = keccak256(
            encodePacked(['bytes32', 'bytes32'], [computedHash, proofElement]),
          );
        } else {
          computedHash = keccak256(
            encodePacked(['bytes32', 'bytes32'], [proofElement, computedHash]),
          );
        }
      }

      return computedHash.toLowerCase() === root.toLowerCase();
    } catch (ex: any) {
      EcoError.logErrorWithStack(ex, `verifyProof: exception`, this.logger);
      return false;
    }
  }

  /**
   * Helper to format permits for a specific chain
   * This ensures proper typing and structure
   */
  formatChainPermits(chainId: number | bigint, permits: AllowanceOrTransfer[]): ChainPermits {
    return {
      chainId: BigInt(chainId),
      permits: permits.map((p) => ({
        modeOrExpiration: p.modeOrExpiration,
        tokenKey: p.tokenKey, // Changed from token to tokenKey
        account: p.account,
        amountDelta: p.amountDelta,
      })),
    };
  }

  /**
   * Helper to create AllowanceOrTransfer for ERC20 tokens
   * Automatically encodes the token address as tokenKey
   */
  static createErc20Permit(
    tokenAddress: Hex,
    account: Hex,
    amountDelta: bigint,
    modeOrExpiration: number = 0,
  ): AllowanceOrTransfer {
    return {
      modeOrExpiration,
      tokenKey: this.encodeTokenKey(tokenAddress),
      account,
      amountDelta,
    };
  }

  /**
   * Helper to create AllowanceOrTransfer for NFTs
   * Automatically encodes the token + tokenId as tokenKey
   */
  static createNftPermit(
    tokenAddress: Hex,
    tokenId: bigint,
    account: Hex,
    amountDelta = 1n, // Usually 1 for NFTs
    modeOrExpiration: number = 0,
  ): AllowanceOrTransfer {
    return {
      modeOrExpiration,
      tokenKey: this.encodeNftTokenKey(tokenAddress, tokenId),
      account,
      amountDelta,
    };
  }

  /**
   * Encode ERC20 token address as bytes32 tokenKey
   * For ERC20: bytes32(uint256(uint160(address)))
   */
  static encodeTokenKey(tokenAddress: Hex): Hex {
    // Convert address to bytes32 by padding with zeros
    return pad(tokenAddress, { size: 32 }) as Hex;
  }

  /**
   * Encode NFT tokenKey for signed permits
   * Creates unique identifier for token + tokenId combination
   */
  static encodeNftTokenKey(tokenAddress: Hex, tokenId: bigint): Hex {
    return keccak256(encodePacked(['address', 'uint256'], [tokenAddress, tokenId]));
  }
}
