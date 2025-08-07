import { FeeDetails } from '@/modules/fulfillment/validations/fee-calculation.interface';

export interface ValidationResult {
  validation: string;
  passed: boolean;
  error?: string;
}

export interface QuoteResult {
  valid: boolean;
  strategy: string;
  fees?: FeeDetails;
  validationResults: ValidationResult[];
}