export const PROOF_STORAGE = 0
export const PROOF_HYPERLANE = 1

export type ProofType = typeof PROOF_STORAGE | typeof PROOF_HYPERLANE

export const Proofs: Record<string, ProofType> = {
  Storage: PROOF_STORAGE,
  Hyperlane: PROOF_HYPERLANE,
}
