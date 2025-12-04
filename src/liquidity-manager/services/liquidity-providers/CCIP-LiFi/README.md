# CCIP-LiFi Hybrid Provider

A hybrid liquidity provider that combines **Chainlink CCIP** for cross-chain token bridging with **LiFi** for source/destination chain swaps.

## Overview

The CCIP-LiFi provider enables rebalancing any token pair where both chains have CCIP support for a common bridgeable token (e.g., USDC, LINK). It automatically plans and executes:

1. **Source Swap** (optional): Swap input token → bridge token via LiFi
2. **CCIP Bridge**: Transfer bridge token cross-chain via CCIP
3. **Destination Swap** (optional): Swap bridge token → output token via LiFi

## Architecture

```
src/liquidity-manager/services/liquidity-providers/CCIP-LiFi/
├── ccip-lifi-provider.service.ts      # Main provider service
├── ccip-lifi-provider.service.spec.ts # Unit tests
├── README.md
└── utils/
    ├── route-planner.ts               # Route planning logic
    ├── route-planner.spec.ts          # Route planner tests
    ├── slippage-calculator.ts         # Slippage calculation
    └── validation.ts                  # Gas estimation
```

## Configuration

Add to your config:

```typescript
ccipLiFi: {
  maxSlippage: 0.05,
  bridgeTokens: {
    1: { USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    10: { USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
    // ... other chains
  }
}
```

## Execution Flow

1. `getQuote()` plans the route and gets LiFi quotes for swaps
2. `execute()` runs:
   - Source swap via LiFi (if needed)
   - CCIP bridge with `ccipLiFiContext` attached
3. `CheckCCIPDeliveryJob` monitors CCIP delivery
4. On delivery, if `ccipLiFiContext` exists, enqueues `CCIPLiFiDestinationSwapJob`
5. Destination swap executes via LiFi
6. Rebalance marked complete

## Jobs

- **CheckCCIPDeliveryJob**: Extended to support `ccipLiFiContext`
- **CCIPLiFiDestinationSwapJob**: Executes destination swap after CCIP delivery

## Testing

```bash
pnpm test -- ccip-lifi-provider.service.spec.ts
pnpm test -- route-planner.spec.ts
```
