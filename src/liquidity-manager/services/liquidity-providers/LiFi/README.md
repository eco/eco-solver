# Liquidity Manager Logging Configuration

This document covers logging configuration for liquidity management services.

## Services

### LiFi Provider Service

Handles cross-chain liquidity routing using the LiFi SDK.

### Liquidity Manager Service

Manages automatic token rebalancing across chains, coordinating between different liquidity providers.

## Logging Configuration

Both services generate extensive logs during development. By default, verbose logging is **enabled** for detailed debugging.

### Environment Variables

| Service       | Environment Variable         | Default   | Description                                                                           |
| ------------- | ---------------------------- | --------- | ------------------------------------------------------------------------------------- |
| Both Services | `LIQUIDITY_SERVICES_LOGGING` | `verbose` | Set to `quiet` to silence detailed operation logs for both LiFi and Liquidity Manager |

### Quieting Verbose Logging

```bash
# Quiet verbose logging for both services
export LIQUIDITY_SERVICES_LOGGING=quiet
```

### What Verbose Logging Includes

#### LiFi Provider Service

When `LIQUIDITY_SERVICES_LOGGING` is not set to `quiet` (default verbose):

- Fallback routing attempts with core tokens
- Quote execution details (tokens, amounts, gas costs, steps)
- Individual process steps during route execution
- Core token routing failures and retries

#### Liquidity Manager Service

When `LIQUIDITY_SERVICES_LOGGING` is not set to `quiet` (default verbose):

- Strategy quote details for rebalancing operations
- Direct route failures and fallback attempts
- Core token routing attempts and results
- Detailed error information for failed routes

### VS Code Development

#### For Clean Development

To reduce log verbosity during development, set the logging environment variables to `quiet`:

#### VS Code Launch Configuration

To configure logging in specific VS Code debug sessions, add to your `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch with Quiet Liquidity Services Logging",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "env": {
        "LIQUIDITY_SERVICES_LOGGING": "quiet"
      },
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal"
    },
    {
      "name": "Launch with Quiet Liquidity Services Logging (duplicate)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "env": {
        "LIQUIDITY_SERVICES_LOGGING": "quiet"
      },
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal"
    },
    {
      "name": "Launch with Quiet Liquidity Services Logging (duplicate2)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "env": {
        "LIQUIDITY_SERVICES_LOGGING": "quiet"
      },
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal"
    },
    {
      "name": "Launch with Default Verbose Logging",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal"
    }
  ]
}
```

#### Terminal/Shell

```bash
# Default verbose logging (no env vars needed)
npm run start:dev

# Quiet liquidity services logging
LIQUIDITY_SERVICES_LOGGING=quiet npm run start:dev
```

## Summary

Both services now provide granular logging control:

- **Verbose by default**: Detailed logs enabled for comprehensive debugging
- **Opt-in quiet mode**: Set `=quiet` to silence detailed logs for cleaner development
- **Service-specific**: Control each service independently
- **VS Code integration**: Easy debug configurations for different scenarios
- **Flexible**: Choose between full debugging details or clean development experience
