import { Enumify } from 'enumify'

export class ProofType extends Enumify {
  static HYPERLANE = new ProofType()
  static METALAYER = new ProofType()
  static _ = ProofType.closeEnum()

  static fromString(enumstr: string): ProofType {
    const value = ProofType.enumValueOf(enumstr)

    if (value) {
      return value as ProofType
    }

    throw new Error(`Proof type ${enumstr} is not supported`)
  }

  isHyperlane(): boolean {
    return this === ProofType.HYPERLANE
  }

  isMetalayer(): boolean {
    return this === ProofType.METALAYER
  }

  toString() {
    return this.enumKey
  }
}
