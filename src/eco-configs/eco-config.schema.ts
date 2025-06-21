import { z } from 'zod'
import { Network } from '@/common/alchemy/network'
import { LIT_NETWORKS_KEYS } from '@lit-protocol/types'
import { IntentExecutionTypeKeys } from '@/quote/enums/intent-execution-type.enum'
import { Hex } from 'viem'

const HexSchema = z.custom<Hex>((val) => {
  return typeof val === 'string' && /^0x[a-fA-F0-9]+$/.test(val)
})

const V2LimitsSchema = z.object({
  tokenBase6: z.bigint(),
  nativeBase18: z.bigint(),
})

const FeeAlgoLinearSchema = z.object({
  baseFee: z.bigint(),
  tranche: z.object({
    unitFee: z.bigint(),
    unitSize: z.bigint(),
  }),
})

const FeeAlgoQuadraticSchema = z.object({
  baseFee: z.bigint(),
  quadraticFactor: z.bigint(),
})

const FeeConfigLinearSchema = z.object({
  algorithm: z.literal('linear'),
  limit: V2LimitsSchema,
  constants: z.object({
    token: FeeAlgoLinearSchema,
    native: FeeAlgoLinearSchema,
  }),
})

const FeeConfigQuadraticSchema = z.object({
  algorithm: z.literal('quadratic'),
  limit: V2LimitsSchema,
  constants: z.object({
    token: FeeAlgoQuadraticSchema,
    native: FeeAlgoQuadraticSchema,
  }),
})

const FeeConfigTypeSchema = z.union([FeeConfigLinearSchema, FeeConfigQuadraticSchema])

const WhitelistFeeRecordSchema = z.record(HexSchema, z.any())

const TargetContractSchema = z.object({
  contractType: z.enum(['erc20', 'erc721', 'erc1155']),
  selectors: z.array(z.string()),
  minBalance: z.number(),
  targetBalance: z.number(),
})

const SolverSchema = z.object({
  inboxAddress: HexSchema,
  targets: z.record(HexSchema, TargetContractSchema),
  network: z.nativeEnum(Network),
  fee: FeeConfigTypeSchema,
  chainID: z.number(),
  averageBlockTime: z.number(),
})

const IntentSourceSchema = z.object({
  network: z.nativeEnum(Network),
  chainID: z.number(),
  sourceAddress: HexSchema,
  inbox: HexSchema,
  tokens: z.array(HexSchema),
  provers: z.array(HexSchema),
  config: z
    .object({
      ecoRoutes: z.enum(['append', 'replace']),
    })
    .optional(),
})

const ServerConfigSchema = z.object({
  url: z.string(),
})

const GasEstimationsConfigSchema = z.object({
  fundFor: z.bigint(),
  permit: z.bigint(),
  permit2: z.bigint(),
  defaultGasPriceGwei: z.string(),
})

const SafeTypeSchema = z.object({
  owner: HexSchema.optional(),
})

const RedisConfigSchema = z.object({
  connection: z.union([
    z.object({
      host: z.string(),
      port: z.number(),
    }),
    z.array(
      z.object({
        host: z.string(),
        port: z.number(),
      }),
    ),
  ]),
  options: z.object({
    single: z.any(),
    cluster: z.any(),
  }),
  redlockSettings: z.any().optional(),
  jobs: z.object({
    intentJobConfig: z.any(),
  }),
})

const IntervalConfigSchema = z.object({
  retryInfeasableIntents: z.object({
    repeatOpts: z.any(),
    jobTemplate: z.object({
      name: z.string().optional(),
      opts: z.any(),
    }),
  }),
  defaults: z.object({
    repeatOpts: z.any(),
    jobTemplate: z
      .object({
        name: z.string().optional(),
        opts: z.any().optional(),
      })
      .optional(),
  }),
})

const QuotesConfigSchema = z.object({
  intentExecutionTypes: z.array(z.enum([...IntentExecutionTypeKeys] as [string, ...string[]])),
})

const SolverRegistrationConfigSchema = z.object({
  apiOptions: z.object({
    baseUrl: z.string(),
  }),
})

const IntentConfigSchema = z.object({
  defaultFee: FeeConfigTypeSchema,
  skipBalanceCheck: z.boolean().optional(),
  proofs: z.object({
    hyperlane_duration_seconds: z.number(),
    metalayer_duration_seconds: z.number(),
  }),
  isNativeETHSupported: z.boolean(),
})

const FulfillmentEstimateConfigSchema = z.object({
  executionPaddingSeconds: z.number(),
  blockTimePercentile: z.number(),
  defaultBlockTime: z.number(),
})

const RpcConfigTypeSchema = z.object({
  config: z.object({
    webSockets: z.boolean().optional(),
  }),
  keys: z.record(z.string()),
  custom: z
    .record(
      z.string(),
      z.object({
        http: z.array(z.string()).optional(),
        webSocket: z.array(z.string()).optional(),
        config: z.any().optional(),
      }),
    )
    .optional(),
})

const LaunchDarklyConfigSchema = z.object({
  apiKey: z.string(),
  options: z.any().optional(),
})

const EthConfigSchema = z.object({
  privateKey: z.string(),
  simpleAccount: z.object({
    walletAddr: HexSchema,
    signerPrivateKey: HexSchema,
    minEthBalanceWei: z.number(),
    contracts: z.object({
      entryPoint: z.object({
        contractAddress: HexSchema,
      }),
      paymaster: z.object({
        contractAddresses: z.array(HexSchema),
      }),
      simpleAccountFactory: z.object({
        contractAddress: HexSchema,
      }),
    }),
  }),
  claimant: HexSchema,
  nonce: z.object({
    update_interval_ms: z.number(),
  }),
  pollingInterval: z.number(),
})

const FulfillTypeSchema = z.object({
  run: z.enum(['batch', 'single']),
  type: z.enum(['crowd-liquidity', 'smart-wallet-account']).optional(),
})

const AwsCredentialSchema = z.object({
  region: z.string(),
  secretID: z.string(),
})

const KmsConfigSchema = z.object({
  region: z.string(),
  keyID: z.string(),
})

const MongoAuthTypeSchema = z.object({
  enabled: z.boolean(),
  username: z.string(),
  password: z.string(),
  type: z.string(),
})

const DatabaseConfigSchema = z.object({
  auth: MongoAuthTypeSchema,
  uriPrefix: z.string(),
  uri: z.string(),
  dbName: z.string(),
  enableJournaling: z.boolean(),
})

const LiquidityManagerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  targetSlippage: z.number(),
  maxQuoteSlippage: z.number(),
  swapSlippage: z.number().optional(),
  intervalDuration: z.number(),
  thresholds: z.object({
    surplus: z.number(),
    deficit: z.number(),
  }),
  coreTokens: z.array(
    z.object({
      token: HexSchema,
      chainID: z.number(),
    }),
  ),
  walletStrategies: z.record(z.array(z.any())),
})

const LiFiConfigTypeSchema = z.object({
  integrator: z.string(),
  apiKey: z.string().optional(),
})

const IndexerConfigSchema = z.object({
  url: z.string(),
})

const WithdrawsConfigSchema = z.object({
  chunkSize: z.number(),
  intervalDuration: z.number(),
})

const SendBatchConfigSchema = z.object({
  chunkSize: z.number(),
  intervalDuration: z.number(),
  defaultGasPerIntent: z.number(),
})

const HyperlaneConfigSchema = z.object({
  useHyperlaneDefaultHook: z.boolean().optional(),
  chains: z.record(
    z.string(),
    z.object({
      mailbox: HexSchema,
      aggregationHook: HexSchema,
      hyperlaneAggregationHook: HexSchema,
    }),
  ),
})

const CrowdLiquidityConfigSchema = z.object({
  litNetwork: z.string() as z.ZodType<LIT_NETWORKS_KEYS>,
  capacityTokenId: z.string(),
  capacityTokenOwnerPk: z.string(),
  defaultTargetBalance: z.number(),
  feePercentage: z.number(),
  actions: z.object({
    fulfill: z.string(),
    rebalance: z.string(),
  }),
  kernel: z.object({
    address: z.string(),
  }),
  pkp: z.object({
    ethAddress: z.string(),
    publicKey: z.string(),
  }),
  supportedTokens: z.array(
    z.object({
      chainId: z.number(),
      tokenAddress: HexSchema,
    }),
  ),
})

const CCTPConfigSchema = z.object({
  apiUrl: z.string(),
  chains: z.array(
    z.object({
      chainId: z.number(),
      domain: z.number(),
      token: HexSchema,
      tokenMessenger: HexSchema,
      messageTransmitter: HexSchema,
    }),
  ),
})

const WarpRoutesConfigSchema = z.object({
  routes: z.array(
    z.object({
      collateral: z.object({
        chainId: z.number(),
        token: HexSchema,
      }),
      chains: z.array(
        z.object({
          chainId: z.number(),
          token: HexSchema,
          synthetic: HexSchema,
        }),
      ),
    }),
  ),
})

const CCTPLiFiConfigSchema = z.object({
  maxSlippage: z.number(),
  usdcAddresses: z.record(z.number(), HexSchema),
})

// Export individual schemas for reuse
export {
  V2LimitsSchema,
  FeeAlgoLinearSchema,
  FeeAlgoQuadraticSchema,
  FeeConfigLinearSchema,
  FeeConfigQuadraticSchema,
  FeeConfigTypeSchema,
  TargetContractSchema,
  SolverSchema,
  IntentSourceSchema,
  SafeTypeSchema,
  AwsCredentialSchema,
  KmsConfigSchema,
  MongoAuthTypeSchema,
  LiquidityManagerConfigSchema,
  LiFiConfigTypeSchema,
  IndexerConfigSchema,
  WithdrawsConfigSchema,
  SendBatchConfigSchema,
  HyperlaneConfigSchema,
  CrowdLiquidityConfigSchema,
  CCTPConfigSchema,
  WarpRoutesConfigSchema,
  CCTPLiFiConfigSchema,
}

export const EcoConfigSchema = z.object({
  server: ServerConfigSchema,
  gasEstimations: GasEstimationsConfigSchema,
  safe: SafeTypeSchema,
  externalAPIs: z.unknown(),
  redis: RedisConfigSchema,
  intervals: IntervalConfigSchema,
  quotesConfig: QuotesConfigSchema,
  solverRegistrationConfig: SolverRegistrationConfigSchema,
  intentConfigs: IntentConfigSchema,
  fulfillmentEstimate: FulfillmentEstimateConfigSchema,
  rpcs: RpcConfigTypeSchema,
  cache: z.any(),
  launchDarkly: LaunchDarklyConfigSchema,
  eth: EthConfigSchema,
  fulfill: FulfillTypeSchema,
  aws: z.array(AwsCredentialSchema),
  kms: KmsConfigSchema,
  whitelist: WhitelistFeeRecordSchema,
  database: DatabaseConfigSchema,
  intentSources: z.array(IntentSourceSchema),
  solvers: z.record(z.coerce.number(), SolverSchema),
  logger: z.object({
    usePino: z.boolean(),
    pinoConfig: z.any(),
  }),
  liquidityManager: LiquidityManagerConfigSchema,
  liFi: LiFiConfigTypeSchema,
  indexer: IndexerConfigSchema,
  withdraws: WithdrawsConfigSchema,
  sendBatch: SendBatchConfigSchema,
  hyperlane: HyperlaneConfigSchema,
  crowdLiquidity: CrowdLiquidityConfigSchema,
  CCTP: CCTPConfigSchema,
  warpRoutes: WarpRoutesConfigSchema,
  cctpLiFi: CCTPLiFiConfigSchema,
  gaslessIntentdAppIDs: z.array(z.string()).optional(),
})
