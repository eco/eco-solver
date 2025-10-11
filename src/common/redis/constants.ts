export const QUEUES: Record<any, QueueInterface> = {
  SOURCE_INTENT: {
    queue: 'source_intent',
    prefix: '{source-intent}',
    jobs: {
      create_intent: 'create_intent',
      validate_intent: 'validate_intent',
      feasable_intent: 'feasable_intent',
      retry_intent: 'retry_intent',
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
  ETH_SOCKET: {
    queue: 'eth_socket',
    prefix: '{eth_socket}',
    jobs: {
      erc20_balance_socket: 'erc20_balance_socket',
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
  INTENT_PROCESSOR: {
    queue: 'IntentProcessorQueue',
    prefix: '{intent-processor}',
    jobs: {
      CHECK_WITHDRAWS: 'CHECK_WITHDRAWS',
      CHECK_SEND_BATCH: 'CHECK_SEND_BATCH',
      EXECUTE_WITHDRAWS: 'EXECUTE_WITHDRAWS',
      EXECUTE_SEND_BATCH: 'EXECUTE_SEND_BATCH',
    },
  },
  LIQUIDITY_MANAGER: {
    queue: 'LiquidityManagerQueue',
    prefix: '{liquidity-manager}',
    jobs: {
      REBALANCE: 'REBALANCE',
      CHECK_BALANCES: 'CHECK_BALANCES',
      CHECK_CCTP_ATTESTATION: 'CHECK_CCTP_ATTESTATION',
      EXECUTE_CCTP_MINT: 'EXECUTE_CCTP_MINT',
      CCTP_LIFI_DESTINATION_SWAP: 'CCTP_LIFI_DESTINATION_SWAP',
      CHECK_CCTPV2_ATTESTATION: 'CHECK_CCTPV2_ATTESTATION',
      EXECUTE_CCTPV2_MINT: 'EXECUTE_CCTPV2_MINT',
      CHECK_EVERCLEAR_INTENT: 'CHECK_EVERCLEAR_INTENT',
      GATEWAY_TOP_UP: 'GATEWAY_TOP_UP',
      CHECK_OFT_DELIVERY: 'CHECK_OFT_DELIVERY',
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
