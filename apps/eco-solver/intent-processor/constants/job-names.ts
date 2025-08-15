/**
 * Job names for intent processor to break circular dependencies
 */
export enum IntentProcessorJobName {
  CHECK_WITHDRAWS = 'CHECK_WITHDRAWS',
  CHECK_SEND_BATCH = 'CHECK_SEND_BATCH',
  EXECUTE_WITHDRAWS = 'EXECUTE_WITHDRAWS',
  EXECUTE_SEND_BATCH = 'EXECUTE_SEND_BATCH',
}