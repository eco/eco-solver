export interface DatabaseConfig {
  uri: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface EvmConfig {
  rpcUrl: string;
  wsUrl: string;
  chainId: number;
  privateKey: string;
  walletAddress: string;
  intentSourceAddress: string;
  inboxAddress: string;
}

export interface SolanaConfig {
  rpcUrl: string;
  wsUrl: string;
  secretKey: string;
  walletAddress: string;
  programId: string;
}

export interface QueueConfig {
  defaultJobOptions: {
    attempts: number;
    backoff: {
      type: string;
      delay: number;
    };
  };
  concurrency: number;
  maxRetriesPerRequest?: number;
  retryDelayMs?: number;
}

export interface AppConfig {
  port: number;
  env: string;
}