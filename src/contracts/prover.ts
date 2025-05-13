export const PROOF_HYPERLANE = 'Hyperlane'
export const PROOF_METALAYER = 'Metalayer'

export type ProofType = typeof PROOF_HYPERLANE | typeof PROOF_METALAYER

export const Proofs: Record<string, ProofType> = {
  Hyperlane: PROOF_HYPERLANE,
  Metalayer: PROOF_METALAYER,
}
