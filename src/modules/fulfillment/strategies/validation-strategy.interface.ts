import { Intent } from '@/common/interfaces/intent.interface';

export interface ValidationStrategy {
  validate(intent: Intent): Promise<boolean>;
}
