import { concat, Hex, pad } from 'viem'
// Helper function to prepare encoded proofs from fulfilled intents
// This is used for fetchFee() calls and should NOT include chain ID prefix
export function prepareEncodedProofs(
  intentHashes: string[],
  claimants: string[],
): Hex {
  const parts: `0x${string}`[] = []
  for (let i = 0; i < intentHashes.length; i++) {
    // If claimant is already 32 bytes (66 chars with 0x), use as is
    // Otherwise, pad it to 32 bytes
    const claimantBytes =
      claimants[i].length === 66
        ? claimants[i] as `0x${string}`
        : pad(claimants[i] as `0x${string}`, { size: 32 })
    parts.push(intentHashes[i] as `0x${string}`)
    parts.push(claimantBytes)
  }
  return concat(parts)
}