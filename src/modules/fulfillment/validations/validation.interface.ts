import { Intent } from '@/common/interfaces/intent.interface';

export interface Validation {
  /**
   * Validate the intent
   * @param intent The intent to validate
   * @returns true if validation passes, false otherwise
   * @throws Error with specific validation failure reason
   */
  validate(intent: Intent): Promise<boolean>;
}
