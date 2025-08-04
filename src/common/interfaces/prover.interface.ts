export interface ProverResult {
  isValid: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export const ProverType = {
  HYPER: 'hyper',
  METALAYER: 'metalayer',
} as const;
