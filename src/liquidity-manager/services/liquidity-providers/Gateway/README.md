### Gateway liquidity strategy (USDC → USDC)

#### Overview

Circle Gateway is used as a zero-slippage USDC cross-chain primitive. This strategy mints USDC on the destination chain using a Circle attestation derived from an EIP-712 burn intent signed by the solver EOA. After a successful mint, a top-up job replenishes the solver’s unified balance by depositing from the Kernel smart account on behalf of the EOA.

#### Key files

- Provider: `src/liquidity-manager/services/liquidity-providers/Gateway/gateway-provider.service.ts`
- HTTP client: `src/liquidity-manager/services/liquidity-providers/Gateway/utils/gateway-client.ts`
- ABIs: `src/liquidity-manager/services/liquidity-providers/Gateway/constants/abis.ts`
- Errors: `src/liquidity-manager/services/liquidity-providers/Gateway/gateway.errors.ts`
- Top-up job: `src/liquidity-manager/jobs/gateway-topup.job.ts`
  - One-time bootstrap: `ensureBootstrapOnce()` in the provider (see below)

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
  bootstrap?: {
    enabled: boolean
    chainId: number // source chain to deposit from
    amountBase6: string // fixed deposit (USDC base-6)
  }
  chains: { chainId: number; domain: number; usdc: Hex; wallet?: Hex; minter?: Hex }[]
}
```

Notes:

- `wallet` (GatewayWallet) and `minter` (GatewayMinter) are optional overrides. The provider resolves these from the Gateway Info API by default and only uses config values if present.
- No API key is required; requests are unauthenticated.

Bootstrap config:

- If `bootstrap.enabled` is true, on application startup the provider checks the depositor’s unified USDC balance on the configured domain. If it is zero, it enqueues a single `GATEWAY_TOP_UP` for `amountBase6` from Kernel via `depositFor`, then stops.
- Depositor is the default signer (EOA); funds are spent by Kernel.

#### How it works

1. Quote (`getQuote`)

- Validates cross-chain, USDC→USDC using configured addresses
- Loads supported domains from Gateway Info (cached with `@Cacheable`)
- Fetches per-domain unified balances for the EOA and selects source domains that cover the requested amount
- Returns a zero-slippage quote with `amountIn == amountOut` and sets `context.sources` to the selected breakdown

2. Execute (`execute`)

- Builds one EIP‑712 burn intent per selected source domain (splitting by `context.sources`)
- Signs each burn intent with the solver EOA
- Submits an array payload to `/v1/transfer`:

```json
[
  {
    "burnIntent": {
      "maxBlockHeight": "...",
      "maxFee": "...",
      "spec": {
        /* TransferSpec */
      }
    },
    "signature": "0x..."
  }
]
```

- Receives `{ attestation, signature, transferId }`, then calls destination `GatewayMinter.gatewayMint(attestation, signature)`
- Enqueues a single `GATEWAY_TOP_UP` to replenish the solver EOA unified balance on the `tokenIn` chain for the full amount

3. Top‑up job (`GATEWAY_TOP_UP`)

- Kernel executes a batch: `ERC20.approve(GatewayWallet, amount)` + `GatewayWallet.depositFor(USDC, depositor=EOA, amount)`
- Waits for receipt to mark the job complete

4. Bootstrap deposit (optional)

- Implemented in `ensureBootstrapOnce()` on the provider.
- On boot: if `gateway.bootstrap.enabled` and `/v1/balances` shows zero for `{ domain, depositor }`, enqueue a single `GATEWAY_TOP_UP` with `id: 'bootstrap'`.
- Uses configured `bootstrap.chainId` and `bootstrap.amountBase6`.

#### Error handling & caching

- Non-200 API responses throw `GatewayApiError` with `status` and response body
- Supported domains (`/v1/info`) are cached for 1 hour via `@Cacheable`
- Structured logs include correlation `id` and key properties

#### Enabling the strategy

Add `'Gateway'` to the solver wallet strategies (e.g., `eco-wallet`) in `liquidityManager.walletStrategies`. Ensure `gateway.enabled !== false`.

#### Tests

- Unit tests: `src/liquidity-manager/services/liquidity-providers/Gateway/gateway-provider.service.spec.ts`
  - Quote validations and zero-slippage
  - Multi-source selection in quote (`context.sources`)
  - Execute: multi-intent signing → attestation array → mint → top‑up enqueue
  - Bootstrap: ensures enqueue is gated by zero balance

#### References

- Gateway overview: https://developers.circle.com/gateway
- Quickstart (multi-intent & balances): https://developers.circle.com/gateway/quickstarts/unified-balance
- API: `/v1/info`, `/v1/balances`, `/v1/transfer`
