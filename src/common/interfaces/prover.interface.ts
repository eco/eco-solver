export interface ProverResult {
  isValid: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export const ProverType = {
  HYPER: 'hyper',
  POLYMER: 'polymer',
  METALAYER: 'metalayer',
  DUMMY: 'dummy',
} as const;

export const ProverTypeValues = [
  ProverType.HYPER,
  ProverType.POLYMER,
  ProverType.METALAYER,
  ProverType.DUMMY,
] as const;
export type TProverType = (typeof ProverType)[keyof typeof ProverType];
