## USDT0-LiFi Provider

A hybrid rebalancing strategy that combines LiFi swaps with USDT0 (LayerZero OFT v2) bridging to move value across EVM chains. It swaps into USDT on the source chain when needed, bridges via USDT0, and optionally swaps out of USDT on the destination chain.

### How it works (high level)

- Plan steps: sourceSwap (if not USDT) → usdt0Bridge → destinationSwap (if not USDT)
- Quote LiFi on source/destination and aggregate slippage
- Execute source swap (LiFi)
- Bridge with USDT0 send() and enqueue a delivery check
- On delivery, enqueue and execute the destination swap (LiFi)

### Key files

- `usdt0-lifi-provider.service.ts` — Orchestration (quote + execute)
- `utils/route-planner.ts` — Step planning and USDT address mapping
- `utils/validation.ts` — Route validation (chains/tokens/slippage)
- `utils/slippage-calculator.ts` — Combined slippage calc
- Jobs: `../../../../jobs/check-oft-delivery.job.ts` (delivery poll), `../../../../jobs/usdt0-lifi-destination-swap.job.ts` (dest swap)

### Configuration

- `eco-configs`: `usdt0.chains` entries with `{ chainId, eid, type: 'adapter'|'oft', contract, [underlyingToken|token], decimals }`
- `liquidityManager.walletStrategies` should include `USDT0LiFi`
- LiFi integrator/API and RPCs configured via `EcoConfigService`

### Operational signals

- Logs: structured messages for LiFi requests, USDT0 quoteOFT/quoteSend/send, delivery status, and swap results
- Jobs: `CHECK_OFT_DELIVERY` (poll), `USDT0_LIFI_DESTINATION_SWAP` (final swap)

### Quick validation checklist

- TOKEN → TOKEN (three-step path) completes with expected amount
- TOKEN → USDT (source swap + bridge) completes; no destination swap
- USDT → TOKEN (bridge + destination swap) completes
- USDT → USDT (bridge-only) confirms delivery without swaps
