export class PermitType extends Enumify {
  static PERMIT = new PermitType()
  static PERMIT2 = new PermitType()
  static _ = PermitType.closeEnum()

  static fromString(enumstr: string): PermitType | undefined {
    const value = PermitType.enumValueOf(enumstr)

    if (value) {
      return value as PermitType
    }

    return undefined
  }

  isPermit(): boolean {
    return this === PermitType.PERMIT
  }

  isPermit2(): boolean {
    return this === PermitType.PERMIT2
  }

  toString() {
    return this.enumKey
  }
}
