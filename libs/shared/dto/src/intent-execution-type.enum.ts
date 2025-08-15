import { Enumify } from 'enumify'

export class IntentExecutionType extends Enumify {
  static SELF_PUBLISH = new IntentExecutionType()
  static GASLESS = new IntentExecutionType()
  static _ = IntentExecutionType.closeEnum()

  static fromString(enumstr: string): IntentExecutionType | undefined {
    const value = IntentExecutionType.enumValueOf(enumstr)

    if (value) {
      return value as IntentExecutionType
    }

    return undefined
  }

  isSelfPublish(): boolean {
    return this === IntentExecutionType.SELF_PUBLISH
  }

  isGasless(): boolean {
    return this === IntentExecutionType.GASLESS
  }

  override toString() {
    return this.enumKey
  }
}

export const IntentExecutionTypeKeys = ['SELF_PUBLISH', 'GASLESS'] as const