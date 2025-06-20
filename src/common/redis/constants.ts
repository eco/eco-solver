export const QUEUES: Record<any, QueueInterface> = {
  SOURCE_INTENT: {
    queue: 'source_intent',
    prefix: '{source-intent}',
    jobs: {
      create_intent: 'create_intent',
      validate_intent: 'validate_intent',
      feasable_intent: 'feasable_intent',
      fulfill_intent: 'fulfill_intent',
      retry_intent: 'retry_intent',
      withdrawal: 'withdrawal_intent',
    },
  },
  INTERVAL: {
    queue: 'interval',
    prefix: '{interval}',
    jobs: {
      retry_infeasable_intents: 'retry_infeasable_intents',
    },
  },
  INBOX: {
    queue: 'inbox',
    prefix: '{inbox}',
    jobs: {
      fulfillment: 'fulfillment',
    },
  },
  WATCH_RPC: {
    queue: 'watch_rpc',
    prefix: '{watch_rpc}',
    jobs: {
      erc20_balance_rpc: 'erc20_balance_rpc',
      native_balance_rpc: 'native_balance_rpc',
    },
  },
  SIGNER: {
    queue: 'signer',
    prefix: '{signer}',
    jobs: {
      nonce_sync: 'nonce_sync',
    },
  },
  SOLVER: {
    queue: 'solver',
    prefix: '{solver}',
    jobs: {},
  },
  BALANCE_MONITOR: {
    queue: 'balance_monitor',
    prefix: '{balance-monitor}',
    jobs: {
      initialize_monitoring: 'initialize_monitoring',
      update_balance: 'update_balance',
      store_balance: 'store_balance',
    },
  },
}

export interface QueueMetadata {
  queue: string
  prefix: string
}

export interface QueueInterface extends QueueMetadata {
  jobs: Record<string, string>
}
