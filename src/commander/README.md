# Eco-Solver CLI Commands

The Eco-Solver CLI provides command-line access to various services and operations within the NestJS application. This is particularly useful for debugging, monitoring, and operational tasks.

## Quick Start

Run any CLI command using:
```bash
yarn cli <command> [options]
```

To see all available commands:
```bash
yarn cli --help
```

You can interact with the preprod environments by connecting your VPN and aws-sso on your terminal, then:
```bash 
NODE_ENV=preproduction yarn cli <command> [options]
```

## Available Commands

### 1. `balance` - Wallet Balance Management

Query token balances across different chains for the Kernel wallet.

#### Usage
```bash
yarn cli balance [options]
```

#### Options
- `-c, --chainID <chainID>`: Specify chain ID to query
- `-t, --token <token>`: Specify token address to query
- `-h, --help`: Display help for balance command

#### Examples

**Query all tokens on all chains:**
```bash
yarn cli balance
```

**Query all tokens on a specific chain:**
```bash
yarn cli balance -c 84532  # Base Sepolia
yarn cli balance -c 1      # Ethereum Mainnet
```

**Query specific token on specific chain:**
```bash
yarn cli balance -c 84532 -t 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

#### Output Format
```json
{
  "address": "0x123...",
  "chainId": 84532,
  "balances": [
    {
      "token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "balance": "1000000",
      "decimals": 6,
      "normalizedBalance": "1.0"
    }
  ]
}
```

### 2. `transfer` - Token Transfer Operations

Transfer ERC20 tokens or native tokens from the Kernel wallet to other addresses.

#### Usage
```bash
yarn cli transfer <recipient> [options]
```

#### Options
- `-t, --token <token>`: ERC20 token address to transfer
- `-a, --amount <amount>`: Amount in token decimals (for ERC20)
- `-c, --chainID <chainID>`: Chain ID for the transfer
- `-e, --everything`: Transfer all tokens on the specified chain
- `-n, --native <native>`: Amount of native tokens in ETH format
- `-h, --help`: Display help for transfer command

#### Examples

**Transfer ERC20 tokens:**
```bash
yarn cli transfer 0xRecipientAddress \
  -t 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  -a 1000000 \
  -c 84532
```

**Transfer native tokens (ETH):**
```bash
yarn cli transfer 0xRecipientAddress \
  -n 0.1 \
  -c 84532
```

**Transfer all tokens from a chain:**
```bash
yarn cli transfer 0xRecipientAddress \
  -e \
  -c 84532
```

#### Output Format
```json
{
  "success": true,
  "transactionHash": "0xabc123...",
  "recipient": "0x456...",
  "amount": "1000000",
  "token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "chainId": 84532
}
```

### 3. `safe` - Safe Transaction Calldata Generation

Generate transaction calldata for Safe transactions via OwnableExecutor module integration.

#### Usage
```bash
yarn cli safe [options]
```

#### Options
- `-k, --kernel <kernel>`: Kernel wallet address
- `-t, --to <to>`: Recipient address
- `-a, --amount <amount>`: Transfer amount in token decimals
- `-tk, --token <token>`: ERC20 token address
- `-h, --help`: Display help for safe command

#### Example
```bash
yarn cli safe \
  -k 0xKernelAddress \
  -t 0xRecipientAddress \
  -a 1000000 \
  -tk 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

#### Output Format
```json
{
  "calldata": "0x...",
  "to": "0x...",
  "value": "0"
}
```

### 4. `configs` - Configuration Management

Display configuration information and supported chains.

#### Usage
```bash
yarn cli configs [task]
```

#### Examples

**Display all configurations:**
```bash
yarn cli configs
```

**Display supported chains:**
```bash
yarn cli configs chains
```

#### Output Format
```json
{
  "supportedChains": [1, 8453, 84532, 42161],
  "solvers": {
    "1": {
      "chainID": 1,
      "network": "mainnet",
      "targets": { ... }
    }
  }
}
```

## Common Patterns

### Address Validation
All commands automatically validate and checksum addresses using viem's `getAddress` function.

### Chain ID Support
Supported chain IDs include:
- `1` - Ethereum Mainnet
- `8453` - Base Mainnet  
- `84532` - Base Sepolia
- `42161` - Arbitrum One
- Additional chains as configured

### Transaction Confirmation
Transfer operations automatically wait for transaction confirmation and provide transaction hashes.

### Error Handling
Commands provide structured error messages with relevant details:

```json
{
  "error": "Insufficient balance",
  "details": {
    "required": "1000000",
    "available": "500000",
    "token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  }
}
```

## Environment Setup

### Required Environment Variables
Ensure your environment has the necessary configuration:

```bash
# AWS KMS configuration (for transaction signing)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Application configuration
NODE_ENV=development
```

### Configuration Files
The CLI uses the same configuration as the main application:
- Configuration loaded from `eco-configs/`
- AWS Secrets Manager integration
- Redis for caching (if available)

## Architecture

### Service Integration
The CLI commands integrate directly with the main NestJS services:

- **`EcoConfigService`**: Configuration and supported chains
- **`BalanceService`**: Token balance queries
- **`KernelAccountClientService`**: ERC-4337 smart wallet operations
- **`KmsService`**: AWS KMS integration for secure signing

### Security
- All transaction signing uses AWS KMS
- Private keys are never exposed in CLI output
- Secure wallet address derivation from KMS keys

## Development

### Adding New Commands

1. Create a new command class extending `CommandRunner`:
```typescript
@Command({ name: 'mycommand', description: 'My custom command' })
export class MyCommand extends CommandRunner {
  async run(inputs: string[], options: Record<string, any>): Promise<void> {
    // Command implementation
  }
}
```

2. Create a module:
```typescript
@Module({
  imports: [/* dependencies */],
  providers: [MyCommand],
})
export class MyCommandModule {}
```

3. Import in `CommanderAppModule`:
```typescript
@Module({
  imports: [
    // ... existing imports
    MyCommandModule,
  ],
})
export class CommanderAppModule {}
```

### Testing Commands
Commands can be tested using the NestJS testing framework with proper service mocking.

## Troubleshooting

### Common Issues

**"No solver found for chain"**: Ensure the chain ID is supported in your configuration.

**"Insufficient balance"**: Check token balances using the `balance` command first.

**"KMS key not found"**: Verify AWS KMS configuration and permissions.

**"Transaction failed"**: Check gas limits and network conditions.

### Debug Mode
Enable debug logging by setting the log level in your configuration:

```bash
yarn cli balance --verbose  # If supported by command
```

### Getting Help
Each command supports the `--help` flag for detailed usage information:

```bash
yarn cli balance --help
yarn cli transfer --help
yarn cli safe --help
yarn cli configs --help
```

## Examples by Use Case

### Monitoring Wallet Balances
```bash
# Check all balances
yarn cli balance

# Monitor specific chain
yarn cli balance -c 84532

# Check specific token
yarn cli balance -c 84532 -t 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### Emergency Token Recovery
```bash
# Transfer all tokens from a chain
yarn cli transfer 0xSafeAddress -e -c 84532

# Transfer specific amount
yarn cli transfer 0xSafeAddress -t 0xTokenAddress -a 1000000 -c 84532
```

### Configuration Debugging
```bash
# Check supported chains
yarn cli configs

# Verify solver configuration
yarn cli configs chains
```

### Safe Integration
```bash
# Generate Safe transaction calldata
yarn cli safe -k 0xKernel -t 0xRecipient -a 1000000 -tk 0xToken
```

This CLI interface provides comprehensive access to the eco-solver functionality for operational tasks, debugging, and monitoring purposes.