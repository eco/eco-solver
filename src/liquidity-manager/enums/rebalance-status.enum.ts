import { Enumify } from 'enumify'

export class RebalanceStatus extends Enumify {
  static PENDING = new RebalanceStatus()
  static COMPLETED = new RebalanceStatus()
  static FAILED = new RebalanceStatus()
  static _ = RebalanceStatus.closeEnum()

  static fromString(enumstr: string): RebalanceStatus | null {
    const value = RebalanceStatus.enumValueOf(enumstr)
    if (value) {
      return value as RebalanceStatus
    }

    return null
  }

  toString() {
    return this.enumKey
  }
}
