export const configuration = () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/intent-solver',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  evm: {
    rpcUrl: process.env.EVM_RPC_URL,
    wsUrl: process.env.EVM_WEBSOCKET_URL,
    chainId: parseInt(process.env.EVM_CHAIN_ID, 10) || 1,
    privateKey: process.env.EVM_PRIVATE_KEY,
    walletAddress: process.env.EVM_WALLET_ADDRESS,
    intentSourceAddress: process.env.EVM_INTENT_SOURCE_ADDRESS,
    inboxAddress: process.env.EVM_INBOX_ADDRESS,
  },

  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    wsUrl: process.env.SOLANA_WEBSOCKET_URL || 'wss://api.mainnet-beta.solana.com',
    secretKey: process.env.SOLANA_SECRET_KEY,
    walletAddress: process.env.SOLANA_WALLET_ADDRESS,
    programId: process.env.SOLANA_PROGRAM_ID,
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 5,
    attempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS, 10) || 3,
    backoffType: 'exponential',
    backoffDelay: parseInt(process.env.QUEUE_RETRY_DELAY, 10) || 5000,
    maxRetriesPerRequest: parseInt(process.env.QUEUE_MAX_RETRIES_PER_REQUEST, 10),
    retryDelayMs: parseInt(process.env.QUEUE_RETRY_DELAY_MS, 10),
  },
});

export default configuration;
