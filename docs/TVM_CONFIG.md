# TVM (Tron) Configuration Guide

This guide explains how to configure TVM (Tron Virtual Machine) support in the blockchain intent solver.

## Environment Variables

To enable TVM support, you need to configure the following environment variables:

### Basic Configuration

```bash
# TVM Network Configuration
TVM_NETWORKS_0_CHAIN_ID=tron-mainnet
TVM_NETWORKS_0_RPC_FULL_NODE=https://api.trongrid.io
TVM_NETWORKS_0_RPC_SOLIDITY_NODE=https://api.trongrid.io
TVM_NETWORKS_0_RPC_EVENT_SERVER=https://api.trongrid.io
TVM_NETWORKS_0_INTENT_SOURCE_ADDRESS=TYourIntentSourceContractAddress
TVM_NETWORKS_0_INBOX_ADDRESS=TYourInboxContractAddress

# TVM Fee Configuration
TVM_NETWORKS_0_FEE_TOKENS_FLAT_FEE=1000000  # 1 TRX in SUN
TVM_NETWORKS_0_FEE_TOKENS_SCALAR_BPS=100    # 1% fee
TVM_NETWORKS_0_FEE_NATIVE_FLAT_FEE=500000   # 0.5 TRX in SUN
TVM_NETWORKS_0_FEE_NATIVE_SCALAR_BPS=50     # 0.5% fee

# TVM Wallet Configuration
TVM_WALLETS_BASIC_PRIVATE_KEY=your_private_key_here  # Without 0x prefix

# TVM Token Support (optional)
TVM_NETWORKS_0_TOKENS_0_ADDRESS=TTokenContractAddress1
TVM_NETWORKS_0_TOKENS_0_DECIMALS=6
TVM_NETWORKS_0_TOKENS_0_LIMIT=1000000

# TVM Prover Configuration (optional)
TVM_NETWORKS_0_PROVERS_HYPER=THyperProverContractAddress
TVM_NETWORKS_0_PROVERS_METALAYER=TMetalayerProverContractAddress
```

### Multiple Networks

You can configure multiple TVM networks (e.g., mainnet and testnet):

```bash
# Mainnet
TVM_NETWORKS_0_CHAIN_ID=tron-mainnet
TVM_NETWORKS_0_RPC_FULL_NODE=https://api.trongrid.io
# ... other mainnet config

# Testnet (Shasta)
TVM_NETWORKS_1_CHAIN_ID=tron-testnet
TVM_NETWORKS_1_RPC_FULL_NODE=https://api.shasta.trongrid.io
TVM_NETWORKS_1_RPC_SOLIDITY_NODE=https://api.shasta.trongrid.io
TVM_NETWORKS_1_RPC_EVENT_SERVER=https://api.shasta.trongrid.io
# ... other testnet config
```

## Key Differences from EVM

1. **Address Format**: Tron uses base58 addresses (starting with 'T') instead of hex addresses
2. **Fee Model**: Uses Energy and Bandwidth instead of gas
3. **Currency**: TRX instead of ETH, with 1 TRX = 1,000,000 SUN
4. **Private Keys**: Tron private keys don't use the '0x' prefix

## Testing

To test your TVM configuration:

1. Ensure Redis and MongoDB are running
2. Set the environment variables above
3. Start the application: `pnpm run start:dev`
4. The TVM listener will automatically start if configured correctly
5. Check logs for "Started TVM listener for chain tron-mainnet"

## Contract Deployment

Before using TVM support, you need to deploy:
- IntentSource contract on Tron
- Inbox contract on Tron
- Any required prover contracts

Make sure to use Tron-compatible versions of these contracts that account for TVM's differences from EVM.