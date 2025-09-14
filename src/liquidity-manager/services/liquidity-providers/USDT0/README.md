## USDT0 Provider (OFT v2)

EVM-only USDT0 rebalancing via LayerZero OFT v2.

### Overview

- Uses OFT v2 contracts to move USD₮0 across EVM chains.
- Ethereum uses an Adapter that locks canonical USDT; other chains use an OFT token that mints/burns.
- Execution is Kernel v2–gated and pays LayerZero fees in native gas.
- Delivery is confirmed asynchronously by a job that observes destination `Transfer` events (mint-from-zero) on the OFT token.

### Ethereum vs. non-Ethereum

- **Ethereum (Adapter path)**
  - Contracts: `OAdapterUpgradeable` (adapter) + canonical USDT (ERC-20).
  - Flow: `approve(USDT -> adapter)` then `adapter.send(sendParam, fee, refundAddress)`.
  - The adapter locks USDT on Ethereum and emits a LayerZero message.
  - Config entry sets `type: 'adapter'`, `contract: <adapter>`, and `underlyingToken: <USDT>`.

- **Non-Ethereum EVMs (OFT token path)**
  - Contracts: `OUpgradeable` (OFT token) on the source chain.
  - Flow: call `oft.send(sendParam, fee, refundAddress)` directly; no USDT approval step.
  - The OFT token burns/mints USD₮0 per message routing.
  - Config entry sets `type: 'oft'` and `contract: <oftToken>`.

Notes

- All chains use OFT v2 `SendParam` with a 32-byte padded `to` address and base-6 `amountLD`.
- `minAmountLD` is computed via `quoteOFT` and `nativeFee` via `quoteSend`.
- Fees are paid in native gas on the source chain; `refundAddress` is the sender wallet.

### Files

- `usdt0-provider.service.ts`: Strategy implementation (`getQuote`, `execute`).
- `constants/abis.ts`: Minimal OFT v2 ABI (quoteOFT, quoteSend, send) and ERC20 approve.
- `oft-client.ts`: Helpers to build calldata for approve/send and quoting.
- `../..../jobs/check-oft-delivery.job.ts`: Delivery confirmation job.

### Config

Global (outside `liquidityManager`) under `usdt0`:

- Per-chain entry: `{ type: 'adapter' | 'oft'; eid: number; contract: Hex; decimals: 6; underlyingToken?: Hex }`.
- Example (see `config/default.ts`).

Strategy selection is controlled via `liquidityManager.walletStrategies` (add `'USDT0'` for the relevant wallet type).

### Behavior

- `getQuote(tokenIn, tokenOut, swapAmount)`
  - Validates that both chains exist in `usdt0.chains`.
  - Returns 1:1 amounts using `parseUnits(swapAmount, tokenIn.decimals)`; `slippage=0`.
- `execute(wallet, quote)`
  - If source type is `adapter`, build `approve(USDT -> adapter)` followed by `send(...)` on adapter.
  - Otherwise, call `send(...)` on the OFT token directly.
  - Computes `minAmountLD` via `quoteOFT`, then `nativeFee` via `quoteSend`, sets `msg.value=nativeFee`.
  - Enqueues `CHECK_OFT_DELIVERY` for destination confirmation.

### Delivery Confirmation

- `CHECK_OFT_DELIVERY` polls destination chain logs on the OFT contract for `Transfer(from=0x0, to=wallet, value=amountLD)` within a recent block window.
- On success, marks the associated rebalance as `COMPLETED`; on final failure, as `FAILED`.

### Tests

- Unit tests live alongside the provider and job:
  - `usdt0-provider.service.spec.ts` (quoting, approve/send sequencing, minAmountLD flow, enqueueing delivery check)
  - `check-oft-delivery.job.spec.ts` (basic start/process behavior)

Run tests:

```bash
pnpm test liquidity-manager/services/liquidity-providers/USDT0
```

### References

- Developer (Deployments): https://docs.usdt0.to/technical-documentation/developer#id-3.-deployments
- Developer (OFT Interfaces): https://docs.usdt0.to/technical-documentation/developer#oft-interfaces
- Assumptions: `docs/liquidity-manager/usdt0/assumptions.md`
