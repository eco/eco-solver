## Fee Service

This module computes solver fees for quotes and exposes helpers used in feasibility checks and quote generation.

### Key Files

- `src/fee/fee.module.ts`: NestJS module wiring
- `src/fee/fee.service.ts`: Fee computation and helpers
- `src/fee/types.ts`: Fee-related DTOs and types
- `src/fee/utils.ts`: Normalization helpers
- `src/fee/tests/*.spec.ts`: Unit tests

### Concepts

#### Normalization

- Token amounts are normalized to base-6 (`BASE_DECIMALS = 6`).
- `convertNormalize`/`deconvertNormalize` convert between token decimals and base-6 for consistent math.

#### Tuple Extraction

For each intent, we derive a route tuple used for overrides and classification:

- `srcChainId`: `route.source`
- `dstChainId`: `route.destination`
- `srcTokens`:
  - Addresses from `reward.tokens[]` (normalized to checksum via `getAddress`)
  - If no token rewards but `reward.nativeValue > 0n`, uses the zero address
- `dstToken`:
  - Prefer `route.tokens[0].token` when present (explicit output token)
  - Else first ERC-20 transfer target found in `route.calls` (as fallback)
  - Else if only native calls exist, use the zero address

If the tuple cannot be derived, fee computation falls back to the selected base fee without overrides or classification. The selection log includes a `dstTokenSource` field that indicates which fallback was used (`transfer | native | routeTokens | unknown`).

#### Fee Precedence

1. Per-route override (`intentConfigs.routeFeeOverrides` exact match)
2. Whitelist fee (creator + chain-specific overrides)
3. Solver fee for the destination chain (with L1 fallback behavior handled upstream)
4. `intentConfigs.defaultFee`

Whitelists are merged into the current fee (`_.merge`), then a matching per-route override replaces the merged fee.

#### Same-asset (nonSwap) Classification

- Tokens are tagged where we already maintain token configs: `solvers[chainId].targets[token].nonSwapGroups?: string[]`.
- A route is treated as nonSwap if `srcToken` and `dstToken` share at least one `nonSwapGroups` tag.
- There is no symbol-based or address-inference; it must be explicitly tagged on both sides.

When nonSwap is true, token fee constants come from `constants.nonSwapToken`; otherwise from `constants.token`. Native always uses `constants.native`.

### Algorithms

Currently supported: `linear`.

For a normalized token amount `A` (base-6) and tranche params `{ unitSize, unitFee }`:

- `units = ceil(A / unitSize)`
- `fee = baseFee + units * unitFee`

The same formula applies independently to tokens (`token` or `nonSwapToken`) and native (`native`).

### Public API (selected)

- `getFeeConfig({ intent?, defaultFeeArg? }): FeeConfigType`
  - Resolves the effective fee config using the precedence chain and logs the decision.

- `getFee(normalizedTotal, intent): NormalizedTotal`
  - Computes the fee for a normalized total using the resolved config and nonSwap classification.

- `getAsk(totalFulfill, intent): NormalizedTotal`
  - Returns `totalFulfill + fee` using `normalizeSum`.

- Helpers used by quote feasibility and generation:
  - `getTotalFill(intent)`: Sum of required token/native across calls (normalized)
  - `getTotalRewards(intent)`: Sum of acceptable rewards (normalized)
  - `calculateTokens(intent)`: Gathers solver balances/deficits and normalized calls/tokens/rewards
  - `getCallsNormalized(intent)`: Normalizes ERC-20 transfers and native calls

### Logging

All logging goes through `EcoLogMessage`:

- Message: `Fee selection`
- Properties:
  - `feeSource`: one of `override | whitelist | solver | default`
  - `isNonSwap`: boolean
  - `srcChainId`, `dstChainId`, `srcTokens`, `dstToken`

### Configuration

Add/modify the following config elements to control fee behavior:

1. Default fee (e.g., in `config/default.ts`):

```ts
intentConfigs: {
  defaultFee: {
    limit: { tokenBase6: 1000n * 10n ** 6n, nativeBase18: 1000n * 10n ** 18n },
    algorithm: 'linear',
    constants: {
      token: { baseFee: 20_000n, tranche: { unitFee: 15_000n, unitSize: 100_000_000n } },
      native: { baseFee: 1_000n, tranche: { unitFee: 500n, unitSize: 1n * 10n ** 18n } },
      nonSwapToken: { baseFee: 20_000n, tranche: { unitFee: 15_000n, unitSize: 100_000_000n } },
    },
  },
}

// Optional per-route overrides at the root level
routeFeeOverrides: [
    // {
    //   sourceChainId: 10,
    //   destinationChainId: 11,
    //   sourceToken: '0x...',
    //   destinationToken: '0x...',
    //   fee: { /* FeeConfigType */ },
    // },
],
```

2. Whitelist (loaded via AWS Secrets):

```ts
whitelist: {
  [creatorAddress]: {
    default: { /* FeeConfigType */ },
    [sourceChainId]: { /* FeeConfigType */ },
  }
}
```

3. Token tags for nonSwap classification (inside solver targets):

```ts
solvers: {
  [chainId]: {
    targets: {
      '0xTokenA': { /* target config */, nonSwapGroups: ['USDC'] },
      '0xTokenB': { /* target config */, nonSwapGroups: ['USDC'] },
    },
    fee: { /* FeeConfigType */ },
  }
}
```

Notes:

- `routeFeeOverrides` match on exact chainIds and checksum-normalized addresses (via `getAddress`).
- Native is represented by the zero address in tuple logic.

### Test Coverage

See `src/fee/tests/fee.service.spec.ts` for:

- Precedence (override vs whitelist vs solver vs default)
- Tuple extraction edge cases (native-only, multi-token rewards)
- nonSwap classification and fee constant selection
- Linear fee math (ceil-based unit counting)

### Limitations & Future Work

- Multi-call routes are currently gated elsewhere; `getCallsNormalized` supports mixed native + ERC-20, but feasibility checks assume a single functional call today.
- no wildcard or partial-match overrides; only exact matches.
- `nonSwapGroups` must be explicitly configured on both sides; there is no symbol or address inference.
