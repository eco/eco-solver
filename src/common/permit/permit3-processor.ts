import {
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  Hex,
  keccak256,
  pad,
} from 'viem'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { AllowanceOrTransferDTO, Permit3DTO } from '@/quote/dto/permit3/permit3.dto'
import { permit3Abi } from '@/contracts/Permit3.abi'

const CHAIN_PERMITS_TYPEHASH = '0xd99e9314320a2f250c82ec176bcdc5b9d3636189bc81a91c483b5a2ded83e4da'

/**
 * Struct representing the UnhingedProof as defined in the contract
 */
interface UnhingedProof {
  nodes: Hex[]
  counts: Hex
}

/**
 * Packs the counts value for an UnhingedProof
 *
 * @param subtreeProofCount Number of nodes in the subtree proof (max 2^120-1)
 * @param followingHashesCount Number of following hashes (max 2^120-1)
 * @param hasPreHash Flag indicating if preHash is present
 * @returns Packed counts as Hex string
 */
export function packCounts(
  subtreeProofCount: bigint,
  followingHashesCount: bigint,
  hasPreHash: boolean,
): Hex {
  // Validate inputs don't exceed maximum
  const MAX_COUNT = 2n ** 120n - 1n
  if (subtreeProofCount > MAX_COUNT) throw new Error('SubtreeProofCount overflow')
  if (followingHashesCount > MAX_COUNT) throw new Error('FollowingHashesCount overflow')

  // Pack the values
  let packedValue = 0n
  packedValue |= subtreeProofCount << 136n // First 120 bits
  packedValue |= followingHashesCount << 16n // Next 120 bits
  // Bits 1-15 are reserved for future use (zeros)
  if (hasPreHash) {
    packedValue |= 1n // Set the last bit if preHash is present
  }

  return pad(`0x${packedValue.toString(16)}`, { size: 32 })
}

/**
 * Extracts the counts from a packed counts value
 *
 * @param counts The packed counts value
 * @returns An object containing subtreeProofCount, followingHashesCount, and hasPreHash
 */
export function extractCounts(counts: Hex): {
  subtreeProofCount: bigint
  followingHashesCount: bigint
  hasPreHash: boolean
} {
  const value = BigInt(counts)

  // Extract the different parts from the packed value
  const subtreeProofCount = value >> 136n // First 120 bits
  const followingHashesCount = (value >> 16n) & ((1n << 120n) - 1n) // Next 120 bits
  // Skip 15 bits reserved for future use
  const hasPreHash = (value & 1n) === 1n // Last bit

  return {
    subtreeProofCount,
    followingHashesCount,
    hasPreHash,
  }
}

/**
 * Verifies a standard Merkle proof for a balanced subtree
 *
 * @param leaf The leaf node to verify
 * @param proof The balanced Merkle proof for the leaf
 * @returns The calculated subtree root
 */
export function verifyBalancedSubtree(leaf: Hex, proof: Hex[]): Hex {
  let computedHash = leaf

  for (let i = 0; i < proof.length; i++) {
    const proofElement = proof[i]

    // Compare as BigInts to match Solidity behavior
    if (BigInt(computedHash) <= BigInt(proofElement)) {
      // Hash(current computed hash + current element of the proof)
      computedHash = keccak256(concat([computedHash, proofElement]))
    } else {
      // Hash(current element of the proof + current computed hash)
      computedHash = keccak256(concat([proofElement, computedHash]))
    }
  }

  return computedHash
}

/**
 * Creates an unhinged root from a list of balanced subtree roots
 *
 * @param subtreeRoots Array of balanced subtree roots in canonical order
 * @returns The unhinged root hash
 */
export function createUnhingedRoot(subtreeRoots: Hex[]): Hex {
  if (subtreeRoots.length === 0) {
    return '0x0000000000000000000000000000000000000000000000000000000000000000'
  }

  let unhingedRoot = subtreeRoots[0]

  for (let i = 1; i < subtreeRoots.length; i++) {
    unhingedRoot = hashLink(unhingedRoot, subtreeRoots[i])
  }

  return unhingedRoot
}

/**
 * Computes a single hash in the unhinged chain
 *
 * @param previousHash The hash of previous operations
 * @param currentHash The hash to append
 * @returns The combined hash
 */
export function hashLink(previousHash: Hex, currentHash: Hex): Hex {
  return keccak256(concat([previousHash, currentHash]))
}

/**
 * Creates an optimized UnhingedProof structure from component parts
 *
 * @param preHash Previous hashes combined (can be zero to indicate no preHash)
 * @param subtreeProof The balanced merkle proof
 * @param followingHashes The array of following hashes
 * @returns The optimized UnhingedProof structure
 */
export function createOptimizedProof(
  preHash: Hex,
  subtreeProof: Hex[],
  followingHashes: Hex[],
): UnhingedProof {
  // Check if preHash is present (non-zero)
  const hasPreHash =
    preHash !== '0x0000000000000000000000000000000000000000000000000000000000000000'

  // Create the combined nodes array
  const nodes: Hex[] = []

  // 1. Add preHash if present
  if (hasPreHash) {
    nodes.push(preHash)
  }

  // 2. Add subtree proof nodes
  for (const node of subtreeProof) {
    nodes.push(node)
  }

  // 3. Add following hash nodes
  for (const node of followingHashes) {
    nodes.push(node)
  }

  // 4. Pack the counts with the hasPreHash flag
  const counts = packCounts(BigInt(subtreeProof.length), BigInt(followingHashes.length), hasPreHash)

  // 5. Create and return the optimized proof
  return { nodes, counts }
}

/**
 * Calculates the unhinged root from a leaf and proof
 *
 * @param leaf The leaf node to calculate from
 * @param proof The unhinged proof structure
 * @returns The calculated unhinged root
 */
export function calculateRoot(leaf: Hex, proof: UnhingedProof): Hex {
  // Extract counts from packed data
  const { subtreeProofCount, followingHashesCount, hasPreHash } = extractCounts(proof.counts)

  // Calculate minimum required nodes
  let minRequiredNodes = subtreeProofCount + followingHashesCount
  if (hasPreHash) {
    minRequiredNodes += 1n
  }

  // Validate the proof structure
  if (hasPreHash && proof.nodes.length === 0) {
    throw new Error('HasPreHashButEmptyNodes')
  }

  if (BigInt(proof.nodes.length) < minRequiredNodes) {
    throw new Error(
      `InvalidNodeArrayLength: expected ${minRequiredNodes}, got ${proof.nodes.length}`,
    )
  }

  if (
    hasPreHash &&
    proof.nodes.length > 0 &&
    proof.nodes[0] === '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    throw new Error('InconsistentPreHashFlag')
  }

  // Extract proof components and establish starting points
  let calculatedRoot: Hex
  const subtreeProofStartIndex = hasPreHash ? 1 : 0

  // Calculate the subtree root directly
  const subtreeProofElements = proof.nodes.slice(
    subtreeProofStartIndex,
    subtreeProofStartIndex + Number(subtreeProofCount),
  )
  const subtreeRoot = verifyBalancedSubtree(leaf, subtreeProofElements)

  // Calculate the unhinged chain - either start with preHash or use subtreeRoot directly
  if (hasPreHash) {
    calculatedRoot = hashLink(proof.nodes[0], subtreeRoot)
  } else {
    calculatedRoot = subtreeRoot
  }

  // Add all following chain hashes
  const followingHashesStartIndex = subtreeProofStartIndex + Number(subtreeProofCount)
  for (let i = 0; i < Number(followingHashesCount); i++) {
    calculatedRoot = hashLink(calculatedRoot, proof.nodes[followingHashesStartIndex + i])
  }

  return calculatedRoot
}

/**
 * Helper function to get the next power of 2
 *
 * @param n The number
 * @returns The next power of 2 that is greater than or equal to n
 */
function nextPowerOf2(n: number): number {
  if (n <= 0) return 1
  n--
  n |= n >> 1
  n |= n >> 2
  n |= n >> 4
  n |= n >> 8
  n |= n >> 16
  return n + 1
}

/**
 * Creates a balanced Merkle tree from a list of leaves
 *
 * @param leaves The list of leaf nodes
 * @returns An object containing the tree layers and the root hash
 */
export function createBalancedMerkleTree(leaves: Hex[]): {
  layers: Hex[][]
  root: Hex
} {
  if (leaves.length === 0) {
    return {
      layers: [],
      root: '0x0000000000000000000000000000000000000000000000000000000000000000',
    }
  }

  // Make a copy so we don't modify the original array
  const layerZero = [...leaves]
  const layers: Hex[][] = [layerZero]

  // If odd number of leaves, duplicate the last one to make it even
  if (layerZero.length % 2 !== 0) {
    layerZero.push(layerZero[layerZero.length - 1])
  }

  // Build tree bottom-up
  let currentLayer = layerZero
  while (currentLayer.length > 1) {
    const nextLayer: Hex[] = []

    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i]
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left

      if (BigInt(left) <= BigInt(right)) {
        nextLayer.push(keccak256(concat([left, right])))
      } else {
        nextLayer.push(keccak256(concat([right, left])))
      }
    }

    layers.push(nextLayer)
    currentLayer = nextLayer
  }

  return {
    layers,
    root: layers[layers.length - 1][0],
  }
}

/**
 * Generates a Merkle proof for a leaf in a balanced Merkle tree
 *
 * @param leafIndex The index of the leaf in the tree
 * @param layers The layers of the Merkle tree
 * @returns The Merkle proof as an array of sibling nodes
 */
export function generateBalancedMerkleProof(leafIndex: number, layers: Hex[][]): Hex[] {
  if (leafIndex < 0 || leafIndex >= layers[0].length) {
    throw new Error(`Leaf index ${leafIndex} is out of bounds (0-${layers[0].length - 1})`)
  }

  const proof: Hex[] = []
  let index = leafIndex

  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i]
    const isRightNode = index % 2 === 0
    const siblingIndex = isRightNode ? index + 1 : index - 1

    // If the sibling index is valid, add the sibling to the proof
    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex])
    }

    // Move to the parent index in the next layer
    index = Math.floor(index / 2)
  }

  return proof
}

/**
 * Creates an UnhingedProof for a specific leaf from all leaves
 *
 * This function constructs an optimized UnhingedProof for a target leaf
 * by dividing the leaves into "previous", "current subtree", and "following" sections.
 *
 * @param leaves All leaves in the unhinged tree
 * @param targetLeafIndex The index of the target leaf to prove
 * @param leafsPerSubtree Optional number of leaves to include in each subtree (must be power of 2)
 * @returns The UnhingedProof structure and calculated root
 */
export function createUnhingedProofFromAllLeaves(
  leaves: Hex[],
  targetLeafIndex: number,
  leafsPerSubtree: number = 0,
): { proof: UnhingedProof; root: Hex } {
  if (targetLeafIndex < 0 || targetLeafIndex >= leaves.length) {
    throw new Error(
      `Target leaf index ${targetLeafIndex} is out of bounds (0-${leaves.length - 1})`,
    )
  }

  // Determine subtree size: if not specified, use the next power of 2 for optimal efficiency
  if (leafsPerSubtree <= 0) {
    leafsPerSubtree = nextPowerOf2(Math.min(leaves.length, 16)) // Default to max 16 leaves per subtree
  } else {
    // Ensure leafsPerSubtree is a power of 2
    if ((leafsPerSubtree & (leafsPerSubtree - 1)) !== 0) {
      throw new Error('leafsPerSubtree must be a power of 2')
    }
  }

  // Calculate subtree boundaries
  const subtreeStartIndex = Math.floor(targetLeafIndex / leafsPerSubtree) * leafsPerSubtree
  const subtreeEndIndex = Math.min(subtreeStartIndex + leafsPerSubtree, leaves.length)

  // Create the subtree from the leaves in the current subtree
  const subtreeLeaves = leaves.slice(subtreeStartIndex, subtreeEndIndex)
  const { layers } = createBalancedMerkleTree(subtreeLeaves)

  // Generate the proof for the target leaf within its subtree
  const subtreeLeafIndex = targetLeafIndex - subtreeStartIndex
  const subtreeProof = generateBalancedMerkleProof(subtreeLeafIndex, layers)

  // Create the preHash from all leaves before the current subtree
  let preHash: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000'
  if (subtreeStartIndex > 0) {
    const previousLeaves = leaves.slice(0, subtreeStartIndex)

    // Combine the previous leaves into balanced subtrees for efficiency
    const previousSubtrees: Hex[] = []
    for (let i = 0; i < previousLeaves.length; i += leafsPerSubtree) {
      const subLeaves = previousLeaves.slice(
        i,
        Math.min(i + leafsPerSubtree, previousLeaves.length),
      )
      const { root } = createBalancedMerkleTree(subLeaves)
      previousSubtrees.push(root)
    }

    // Create the unhinged root from the previous subtrees
    preHash = createUnhingedRoot(previousSubtrees)
  }

  // Create the followingHashes from all leaves after the current subtree
  const followingHashes: Hex[] = []
  if (subtreeEndIndex < leaves.length) {
    const followingLeaves = leaves.slice(subtreeEndIndex)

    // Combine the following leaves into balanced subtrees for efficiency
    for (let i = 0; i < followingLeaves.length; i += leafsPerSubtree) {
      const subLeaves = followingLeaves.slice(
        i,
        Math.min(i + leafsPerSubtree, followingLeaves.length),
      )
      const { root } = createBalancedMerkleTree(subLeaves)
      followingHashes.push(root)
    }
  }

  // Create the optimized proof structure
  const targetLeaf = leaves[targetLeafIndex]
  const proof = createOptimizedProof(preHash, subtreeProof, followingHashes)

  // Calculate the root
  const root = calculateRoot(targetLeaf, proof)

  return { proof, root }
}

export function encodeChainAllowances(
  chainId: bigint,
  chainAllowances: AllowanceOrTransferDTO[],
): Hex {
  const allowanceHashes = chainAllowances.map((allowance) =>
    keccak256(
      encodeAbiParameters(
        [{ type: 'uint48' }, { type: 'address' }, { type: 'address' }, { type: 'uint160' }],
        [
          allowance.modeOrExpiration,
          allowance.token as Hex,
          allowance.account,
          allowance.amountDelta,
        ],
      ),
    ),
  )

  const chainAllowancesHash = keccak256(encodePacked(['bytes32[]'], [allowanceHashes]))

  // Add this chain's hash to our list of chain hashes
  return keccak256(
    encodePacked(
      ['bytes32', 'uint256', 'bytes32'],
      [CHAIN_PERMITS_TYPEHASH, chainId, chainAllowancesHash],
    ),
  )
}

export class Permit3Processor {
  /**
   * Generate Permit3 transaction.
   * @param chainID
   * @param permit3
   */
  static generateTxs(chainID: number, permit3: Permit3DTO): ExecuteSmartWalletArg | undefined {
    const chainPermits = permit3.allowanceOrTransfers.filter((item) => item.chainID === chainID)

    // Get the permits for this specific chain
    if (chainPermits.length === 0) {
      return undefined
    }

    const chainSpecificPermits = {
      chainId: BigInt(chainID),
      permits: chainPermits,
    }

    const leaf = encodeChainAllowances(
      BigInt(chainSpecificPermits.chainId),
      chainSpecificPermits.permits,
    )

    const targetLeafIndex = permit3.leafs.indexOf(leaf)

    const { proof: unhingedProof } = createUnhingedProofFromAllLeaves(
      permit3.leafs,
      targetLeafIndex,
    )

    // Create a chain-specific unhinged proof structure
    const chainSpecificProof: {
      permits: { chainId: bigint; permits: typeof chainSpecificPermits.permits }
      unhingedProof: { nodes: Hex[]; counts: Hex }
    } = {
      permits: chainSpecificPermits,
      unhingedProof: {
        nodes: unhingedProof.nodes,
        counts: unhingedProof.counts,
      },
    }

    // Simulate the transaction to check for potential errors
    const permitData = encodeFunctionData({
      abi: permit3Abi,
      functionName: 'permit',
      args: [
        permit3.owner,
        permit3.salt,
        permit3.deadline,
        permit3.timestamp,
        chainSpecificProof,
        permit3.signature as Hex,
      ],
    })

    return { data: permitData, value: 0n, to: permit3.permitContract }
  }
}
