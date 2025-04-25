export enum IntentExecutionType {
  SELF_PUBLISH = 'SELF_PUBLISH',
  GASLESS = 'GASLESS',
}

export const IntentExecutionTypeKeys = [
  IntentExecutionType.SELF_PUBLISH,
  IntentExecutionType.GASLESS,
] as const
