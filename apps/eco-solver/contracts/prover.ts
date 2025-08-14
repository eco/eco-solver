import { Enumify } from 'enumify'

export class ProofType extends Enumify {
  static HYPERLANE = new ProofType('Hyperlane')
  static METALAYER = new ProofType('Metalayer')
  static _ = ProofType.closeEnum()

  constructor(private providerValue: string) {
    super()
  }

  private static providerValueToEnumMap = new Map<string, ProofType>()

  static initializeProofTypeMap() {
    for (const pt of ProofType) {
      const proofType = pt as ProofType
      this.providerValueToEnumMap.set(proofType.getProviderValue(), proofType)
    }
  }

  static initialize() {
    this.initializeProofTypeMap()
  }

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

  static fromProviderValue(providerValue: string): ProofType {
    const proofType = this.providerValueToEnumMap.get(providerValue)

    if (proofType) {
      return proofType
    }

    throw new Error(`Proof type ${providerValue} is not supported`)
  }

  // static fromProviderValueAsString(providerValue: string): string {
  //   return this.fromProviderValue(providerValue).toString()
  // }

  getProviderValue(): string {
    return this.providerValue
  }

  toString() {
    return this.enumKey
  }
}

ProofType.initialize()
