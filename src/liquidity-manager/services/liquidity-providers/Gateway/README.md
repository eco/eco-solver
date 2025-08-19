### Gateway liquidity strategy (USDC → USDC)

#### Overview

Circle Gateway is used as a zero-slippage USDC cross-chain primitive. This strategy mints USDC on the destination chain using a Circle attestation derived from an EIP-712 burn intent signed by the solver EOA. After a successful mint, a top-up job replenishes the solver’s unified balance by depositing from the Kernel smart account on behalf of the EOA.

#### Key files

- Provider: `src/liquidity-manager/services/liquidity-providers/Gateway/gateway-provider.service.ts`
- HTTP client: `src/liquidity-manager/services/liquidity-providers/Gateway/utils/gateway-client.ts`
- ABIs: `src/liquidity-manager/services/liquidity-providers/Gateway/constants/abis.ts`
- Errors: `src/liquidity-manager/services/liquidity-providers/Gateway/gateway.errors.ts`
- Top-up job: `src/liquidity-manager/jobs/gateway-topup.job.ts`

#### Prerequisites

- USDC balances in the Kernel account on the source chain(s)
- Gateway unified balance tracked for the solver EOA (depositor)
- Accurate chain/domain and USDC mappings in config

#### Configuration

Add a `gateway` section and enable the strategy for the solver wallet via `liquidityManager.walletStrategies`.

```ts
// src/eco-configs/eco-config.types.ts (shape)
export interface GatewayConfig {
  apiUrl: string
  enabled?: boolean
  chains: { chainId: number; domain: number; usdc: Hex; wallet?: Hex; minter?: Hex }[]
}
```

Notes:

- `wallet` (GatewayWallet) and `minter` (GatewayMinter) are optional overrides. The provider resolves these from the Gateway Info API by default and only uses config values if present.
- No API key is required; requests are unauthenticated.

#### How it works

1. Quote (`getQuote`)

- Validates cross-chain, USDC→USDC using configured addresses
- Loads supported domains from Gateway Info (cached with `@Cacheable`)
- Returns a zero-slippage quote with `amountIn == amountOut`

2. Execute (`execute`)

- Uses `/v1/encode` to obtain EIP‑712 typed data (burn intent) with API-populated fields like `maxBlockHeight` and `maxFee`
- Signs burn intent with the solver EOA from `WalletClientDefaultSignerService`
- Submits to `/v1/transfers/attestations` and receives `{ attestation, signature, transferId }`
- Calls destination `GatewayMinter.gatewayMint(attestation, signature)`
- Enqueues `GATEWAY_TOP_UP` to replenish Gateway unified balance on the source chain

3. Top‑up job (`GATEWAY_TOP_UP`)

- Kernel executes a batch: `ERC20.approve(GatewayWallet, amount)` + `GatewayWallet.depositFor(USDC, depositor=EOA, amount)`
- Waits for receipt to mark the job complete

#### Error handling & caching

- Non-200 API responses throw `GatewayApiError` with `status` and response body
- Supported domains (`/v1/info`) are cached for 1 hour via `@Cacheable`
- Structured logs include correlation `id` and key properties

#### Enabling the strategy

Add `'Gateway'` to the solver wallet strategies (e.g., `eco-wallet`) in `liquidityManager.walletStrategies`. Ensure `gateway.enabled !== false`.

#### Tests

- Unit tests: `src/liquidity-manager/services/liquidity-providers/Gateway/gateway-provider.service.spec.ts`
  - Quote validations and zero-slippage
  - Encode → sign → attestation → mint flow and top‑up enqueue

#### References

- Gateway overview: https://developers.circle.com/gateway
- Supported endpoints:
  - `/v1/info`
  - `/v1/encode`
  - `/v1/transfers/attestations`
