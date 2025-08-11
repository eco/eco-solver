// Re-export commonly used types from their original sources
export type { Hex } from 'viem'

// TODO: Move these types to contracts library to break circular dependency
// export type { Network, Solver } from '@libs/integrations'

// Temporary local definitions until we can extract to contracts
export type Network = string | number;
export type Solver = {
  id: string;
  address: string;
};

