# Blockchain Intent Solver API Documentation

## Overview

The Blockchain Intent Solver API provides endpoints for validating cross-chain intents and calculating fulfillment fees. The service supports multiple blockchain networks (EVM and Solana) and uses various strategies for intent fulfillment.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.solver.eco.com`

## Authentication

The API uses API key authentication. Include your API key in one of the following ways:

### Header Authentication (Recommended)
```
X-API-Key: your-api-key-here
```

### Query Parameter Authentication
```
?api_key=your-api-key-here
```

> **Note**: If no API keys are configured (development mode), the API allows open access.

## Rate Limiting

- **Global rate limit**: 100 requests per minute per IP address
- Exceeding the rate limit returns a `429 Too Many Requests` error

## API Reference

### Quotes API

#### Get Quote

Validates an intent and returns a quote with fee requirements.

- **URL**: `/api/v1/quotes`
- **Method**: `POST`
- **Content-Type**: `application/json`

##### Request Body

```json
{
  "intent": {
    "reward": {
      "prover": "0xProverContractAddress1234567890123456789012",
      "creator": "0xCreatorAddress123456789012345678901234567890",
      "deadline": "1735689600",
      "nativeAmount": "1000000000000000",
      "tokens": [
        {
          "amount": "1000000000000000000",
          "token": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"
        }
      ]
    },
    "route": {
      "source": "1",
      "destination": "137",
      "salt": "0x1234567890abcdef",
      "inbox": "0xInboxAddress1234567890123456789012345678901",
      "calls": [
        {
          "data": "0x095ea7b3",
          "target": "0x1234567890123456789012345678901234567890",
          "value": "0"
        }
      ],
      "tokens": [
        {
          "amount": "1000000000000000000",
          "token": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"
        }
      ]
    }
  },
  "strategy": "standard"
}
```

##### Field Descriptions

###### Intent Object
- **reward**: Reward configuration for the intent
  - **prover**: Address of the prover contract (40-character hex)
  - **creator**: Address of the intent creator (40-character hex)
  - **deadline**: Unix timestamp as string (for BigInt compatibility)
  - **nativeAmount**: Native token reward amount as string
  - **tokens**: Array of ERC20 token rewards
    - **amount**: Token amount as string
    - **token**: Token contract address

- **route**: Route configuration for cross-chain execution
  - **source**: Source chain ID as string
  - **destination**: Destination chain ID as string
  - **salt**: Hex value for intent uniqueness
  - **inbox**: Inbox contract address on destination chain
  - **calls**: Array of function calls to execute
    - **data**: Encoded function call data
    - **target**: Target contract address
    - **value**: Native token value to send
  - **tokens**: Array of tokens to transfer

- **strategy** (optional): Fulfillment strategy to use
  - Available values: `standard`, `crowd-liquidity`, `native-intents`, `negative-intents`, `rhinestone`
  - Default: `standard`

##### Success Response (200 OK)

```json
{
  "quoteResponse": {
    "sourceChainID": 1,
    "destinationChainID": 137,
    "sourceToken": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    "destinationToken": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    "sourceAmount": "1000000000000000000",
    "destinationAmount": "990000000000000000",
    "funder": "0x1234567890123456789012345678901234567890",
    "refundRecipient": "0x1234567890123456789012345678901234567890",
    "recipient": "0x1234567890123456789012345678901234567890",
    "fees": [
      {
        "name": "Eco Protocol Fee",
        "description": "Fee charged by Eco Protocol for intent fulfillment",
        "token": {
          "address": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
          "decimals": 18,
          "symbol": "WETH"
        },
        "amount": "10000000000000000"
      }
    ],
    "deadline": 1735689600,
    "estimatedFulfillTimeSec": 300
  },
  "contracts": {
    "intentSource": "0xIntentSourceAddress123456789012345678901234",
    "prover": "0xProverAddress12345678901234567890123456789",
    "inbox": "0xInboxAddress123456789012345678901234567890"
  }
}
```

##### Validation Failed Response (400 Bad Request)

```json
{
  "validations": {
    "passed": ["chain-support", "expiration"],
    "failed": [
      {
        "validation": "funding",
        "reason": "Insufficient token balance"
      },
      {
        "validation": "route-amount-limit",
        "reason": "Amount exceeds maximum limit for this route"
      }
    ]
  }
}
```

##### Error Responses

###### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/quotes",
  "requestId": "req_123456"
}
```

###### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/quotes",
  "requestId": "req_123456"
}
```

###### 429 Too Many Requests
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/quotes",
  "requestId": "req_123456"
}
```

###### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/quotes",
  "requestId": "req_123456"
}
```

### Health Check API

#### General Health Check

Returns the overall health status of the application.

- **URL**: `/health`
- **Method**: `GET`

##### Success Response (200 OK)
```json
{
  "status": "ok",
  "info": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" },
    "blockchain": { "status": "up" }
  },
  "error": {},
  "details": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" },
    "blockchain": { "status": "up" }
  }
}
```

##### Unhealthy Response (503 Service Unavailable)
```json
{
  "status": "error",
  "info": {},
  "error": {
    "mongodb": {
      "status": "down",
      "message": "Connection failed"
    }
  },
  "details": {}
}
```

#### Liveness Check

Simple liveness check for Kubernetes.

- **URL**: `/health/live`
- **Method**: `GET`

##### Response (200 OK)
```json
{
  "status": "ok",
  "info": {},
  "error": {},
  "details": {}
}
```

#### Readiness Check

Checks if the service is ready to handle traffic.

- **URL**: `/health/ready`
- **Method**: `GET`

##### Ready Response (200 OK)
```json
{
  "status": "ok",
  "info": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" },
    "blockchain": { "status": "up" }
  },
  "error": {},
  "details": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" },
    "blockchain": { "status": "up" }
  }
}
```

##### Not Ready Response (503 Service Unavailable)
```json
{
  "status": "error",
  "info": {},
  "error": {
    "redis": {
      "status": "down",
      "message": "Connection timeout"
    }
  },
  "details": {}
}
```

## Swagger Documentation

Interactive API documentation is available via Swagger UI:

- **Development**: `http://localhost:3000/api-docs`
- **Production**: `https://api.solver.eco.com/api-docs`

The Swagger UI provides:
- Interactive API testing
- Complete schema documentation
- Example requests and responses
- Authentication testing

## Client Examples

### cURL

```bash
# Get a quote for an intent
curl -X POST http://localhost:3000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "intent": {
      "reward": {
        "prover": "0xProverContractAddress1234567890123456789012",
        "creator": "0xCreatorAddress123456789012345678901234567890",
        "deadline": "1735689600",
        "nativeAmount": "1000000000000000",
        "tokens": []
      },
      "route": {
        "source": "1",
        "destination": "137",
        "salt": "0x1234567890abcdef",
        "inbox": "0xInboxAddress1234567890123456789012345678901",
        "calls": [],
        "tokens": [
          {
            "amount": "1000000000000000000",
            "token": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"
          }
        ]
      }
    }
  }'

# Health check
curl http://localhost:3000/health
```

### JavaScript/TypeScript

```typescript
// Using fetch
const getQuote = async (intent: Intent) => {
  const response = await fetch('http://localhost:3000/api/v1/quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({ intent })
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
};

// Using axios
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

const getQuote = async (intent: Intent) => {
  const { data } = await api.post('/api/v1/quotes', { intent });
  return data;
};
```

### Python

```python
import requests

def get_quote(intent):
    url = "http://localhost:3000/api/v1/quotes"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": "your-api-key"
    }
    
    response = requests.post(url, json={"intent": intent}, headers=headers)
    response.raise_for_status()
    
    return response.json()

# Health check
def health_check():
    response = requests.get("http://localhost:3000/health")
    return response.json()
```

## Error Handling Best Practices

1. **Always check response status codes**
2. **Handle rate limiting with exponential backoff**
3. **Parse validation errors to provide user feedback**
4. **Log request IDs for debugging**
5. **Implement proper timeout handling**

## BigInt Handling

All numeric values that may exceed JavaScript's safe integer range are transmitted as strings:
- Chain IDs
- Token amounts
- Timestamps
- Native values

Convert these strings to BigInt in your application:
```javascript
const amount = BigInt(response.quoteResponse.sourceAmount);
```

## Supported Chains

The API supports multiple blockchain networks:

### EVM Chains
- Ethereum (Chain ID: 1)
- Polygon (Chain ID: 137)
- Arbitrum (Chain ID: 42161)
- Optimism (Chain ID: 10)
- Base (Chain ID: 8453)
- And more...

### Solana
- Mainnet
- Devnet

Check the quotes endpoint response for the specific chain IDs supported by your deployment.

## Best Practices

1. **Use the quotes endpoint before submitting intents** to ensure they're valid
2. **Cache quote responses** as fees may change over time
3. **Monitor health endpoints** for service availability
4. **Use appropriate strategies** based on your use case
5. **Handle all error scenarios** gracefully in your application

## Support

For support and questions:
- GitHub Issues: https://github.com/eco-foundation/blockchain-intent-solver/issues
- Email: support@eco.com
- Documentation: https://docs.eco.com