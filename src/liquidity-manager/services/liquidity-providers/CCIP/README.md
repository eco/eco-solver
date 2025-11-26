# CCIP Liquidity Provider

This module plugs Chainlink’s Cross-Chain Interoperability Protocol (CCIP) into the liquidity
manager so we can rebalance USDC across any CCIP-supported EVM chains defined in config (the
defaults ship with Ethereum + Ronin, but you can add Base, Arbitrum, etc.). The implementation
mirrors other `IRebalanceProvider` strategies: it quotes transfers, submits router transactions
with our kernel wallet, and waits for a terminal delivery status before marking the rebalance job
complete.

---

## Components

| File                                                      | Responsibility                                                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ccip-provider.service.ts`                                | Implements `IRebalanceProvider<'CCIP'>` (quote + execute) and enqueues delivery tracking jobs.                                                                    |
| `ccip-client.ts`                                          | Local, MIT-licensed port of the CCIP SDK’s read-only helpers (`getFee`, `getOnRampAddress`, `getTransferStatus`). We keep it in-repo to avoid ESM/runtime issues. |
| `ccip-abis.ts`                                            | Router/on-ramp ABIs and both versions of the off-ramp `ExecutionStateChanged` event definition used by the custom client.                                         |
| `src/liquidity-manager/jobs/check-ccip-delivery.job.ts`   | BullMQ job that polls the destination router/off-ramp until the CCIP message reaches a success/failure state, updating rebalance records accordingly.             |
| `src/liquidity-manager/queues/liquidity-manager.queue.ts` | Exposes `startCCIPDeliveryCheck(...)` so the provider can enqueue delivery checks with consistent retry/backoff behavior.                                         |

---

## Configuration

The provider reads all chain metadata, fee preferences, and polling parameters from the `CCIP`
block in the Eco config (`EcoConfigService.getCCIP()`). Relevant fields:

```ts
interface CCIPConfig {
  enabled?: boolean // Set true to allow quotes/execution
  chains: CCIPChainConfig[] // Per-chain router, tokens, and fee tokens
  delivery: {
    maxAttempts: number // Maximum polling attempts before giving up
    backoffMs: number // Delay between polls (ms)
    initialDelayMs: number // Initial delay before first poll (ms)
    queueAttempts: number // BullMQ retry attempts for transient errors (should be >= maxAttempts)
    queueBackoffMs: number // Base delay for BullMQ exponential backoff (ms)
  }
}
```

Example (from `config/default.ts`):

```ts
ccip: {
  enabled: true,
  chains: [
    {
      chainId: 1,
      chainSelector: '5009297550715157269',
      router: '0x80226f…6f7D',
      tokens: {
        USDC: {
          symbol: 'USDC',
          address: '0xA0b8…6eB48',
          decimals: 6,
          tokenPool: '0x03D1…F9FEF',
        },
      },
      supportsNativeFee: true,  // Default: pay CCIP fees in native gas (no fee token configured)
    },
    {
      chainId: 2020, // Ronin (example entry – add more chains as needed)
      chainSelector: '6916147374840168594',
      router: '0x4652…EAf99',
      tokens: {
        USDC: {
          symbol: 'USDC',
          address: '0x0B70…08aDc',
          decimals: 6,
          tokenPool: '0xe26D…1f73C',
        },
      },
      supportsNativeFee: false,  // Native fees unavailable, fall back to a single ERC20 fee token
      feeToken: { symbol: 'LINK', address: '0x3902…22D0b', decimals: 18 },
    },
  ],
  delivery: {
    maxAttempts: 20,
    backoffMs: 10_000,
  },
},
```

> **Note:** The provider only supports same-token routes (e.g., USDC → USDC). Attempting to quote a
> mixed-token route will throw.

To expose CCIP externally and add `'CCIP'` to the wallet’s `walletStrategies` list inside the
`liquidityManager` config block.

---

## Quote Flow

1. Validate that the provider is enabled, chains differ, and both chains have the requested token
   with the same symbol.
2. Fetch the kernel wallet address (used for router approvals and the CCIP destination) and convert
   the incoming amounts to `bigint` with the token’s decimals.
3. Determine fee payment method: native gas by default, or a single configured ERC20 fee token when
   `supportsNativeFee === false`. Call `ccipClient.getFee(...)` with the resolved token to produce an
   estimated fee for the quote context.
4. Return a `RebalanceQuote<'CCIP'>` containing:
   - `context.router`, `sourceChainSelector`, `destinationChainSelector`
   - Token metadata, amount, and fee token choice
   - Estimated fee (so the caller can reason about total costs)

Because CCIP is a same-token bridge, the provider sets `slippage` to `0` and mirrors `amountIn`
into `amountOut`.

---

## Execute Flow

1. Verify the caller’s wallet matches the kernel wallet (execution always goes through the same
   account abstraction client).
2. Check allowance; enqueue an ERC-20 `approve` call if necessary.
3. Refresh the fee quote immediately before submission to avoid stale pricing.
4. Build the router `ccipSend` call (with ABI-encoded receiver, token amount, fee token, and extra
   args) and dispatch the batch via `kernelAccountClientService.execute(...)`.
5. Wait for the transaction receipt, parse the emitted on-ramp event, and extract the CCIP
   `messageId`.
6. Persist a `CheckCCIPDeliveryJob` with BullMQ so we only mark the rebalance as complete when the
   cross-chain message finalizes. The job metadata includes:
   - Source/destination chain IDs & selectors
   - Router addresses
   - `messageId`, `txHash`, wallet address, and rebalance identifiers

Any execution error causes the rebalance status to flip to `FAILED` and surfaces an application log.

---

## Delivery Tracking

- The `CheckCCIPDeliveryJobManager` polls the destination router’s off-ramp using
  `ccipClient.getTransferStatus(...)`.
- Each delivery job captures the destination chain’s block height (minus the
  `TRANSFER_STATUS_FROM_BLOCK_SHIFT` buffer, 100 by default) when it is enqueued and reuses that
  `fromBlockNumber` on every poll so we don’t skip historical `ExecutionStateChanged` events after
  restarts.
- We subtract `TRANSFER_STATUS_FROM_BLOCK_SHIFT` blocks (100 by default) when no `fromBlockNumber`
  is provided so we don’t scan the entire history.
- Off-ramp contracts have shipped multiple `ExecutionStateChanged` signatures (the older one indexed
  three fields; the latest only indexes the sequence number and messageId). The client now checks
  both variants so we can decode the state regardless of which version a particular lane runs.
- `TransferStatus.Success` marks the rebalance as `COMPLETED`; `Failure` throws an
  `UnrecoverableError`, which ultimately marks the job as `FAILED`.
- Retries/backoff respect the `ccip.delivery` config. After the final attempt, the rebalance is
  marked failed even if the CCIP status never became terminal.

---

## Testing

| Suite                                       | Coverage                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ccip-provider.service.spec.ts`             | Quote validation, fee estimation, execution flow, and delivery job enqueueing.           |
| `check-ccip-delivery.job.spec.ts`           | Success/failure polling paths plus rebalance status updates on completion/final failure. |
| `liquidity-provider.service.spec.ts`        | Ensures the top-level strategy router can inject/exercise the CCIP provider.             |
| `cctp-lifi-rebalancing.integration.spec.ts` | Confirms CCIP wiring doesn’t break broader liquidity-manager integrations.               |

Run them individually (fastest during development) or via the full `pnpm test` suite.

---

## Operational Checklist

1. **Config:** Populate `ccip.chains` with the current router, chain selector, USDC token, token
   pool, and fee-token metadata for every supported chain pair. Keep production/staging configs in
   sync.
2. **Wallet Strategies:** Add `'CCIP'` to the appropriate entry under
   `liquidityManager.walletStrategies` so rebalancing jobs can request this provider.
3. **Infrastructure:** Redis and BullMQ must be running so delivery jobs can poll.
4. **Monitoring:** Watch for the `CCIP: delivery failed permanently` log line—it indicates the
   off-ramp emitted `TransferStatus.Failure` and manual intervention may be required.
5. **Upgrades:** If Chainlink ships new router/on-ramp ABIs, update `ccip-abis.ts` and
   `ccip-client.ts` to reflect any signature or event changes.

With these pieces configured, the liquidity manager can automatically use CCIP for USDC-only
rebalancing across whatever chains you list under `ccip.chains` (e.g., Ethereum ↔ Ronin), with
end-to-end visibility from quote through terminal delivery.
