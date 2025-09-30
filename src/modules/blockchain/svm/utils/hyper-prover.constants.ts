// Constants for Hyper prover
export const HYPER_PROVER_CONSTANTS = {
  // PDA seeds
  SEEDS: {
    DISPATCHER: 'dispatcher',
    HYPERLANE: 'hyperlane',
    SEPARATOR: '-',
    OUTBOX: 'outbox',
    DISPATCHED_MESSAGE: 'dispatched_message',
  },
  // Default program IDs (can be overridden by configuration)
  DEFAULT_PROGRAM_IDS: {
    HYPERLANE_MAILBOX: 'E588QtVUvresuXq2KoNEwAmoifCzYGpRBdHByN9KQMbi',
    NOOP: 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV',
    IGP_PROGRAM: 'BhNcatUDC2D5JTyeaqrdSukiVFsEHK7e3hVmKMztwefv',
    IGP_ACCOUNT: 'JAvHW21tYXE9dtdG83DReqU2b4LUexFuCbtJT5tF8X6M',
    OVERHEAD_IGP_ACCOUNT: 'AkeHBbE5JkwVppujCQQ6WuxsVsJtruBAjUo6fDCFp6fF',
  },
  // Buffer sizes
  BUFFER_SIZES: {
    SOURCE_PROVER_BYTES: 32,
  },
};
