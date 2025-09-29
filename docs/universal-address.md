# Universal Address System

## Overview

The Universal Address system provides a chain-agnostic address representation that enables seamless cross-chain operations. It normalizes addresses from different blockchain formats (EVM, Solana, Tron) into a standardized 32-byte hexadecimal format, allowing the system to handle addresses uniformly regardless of the underlying blockchain.

## Why Universal Addresses?

### The Problem
Different blockchains use different address formats:
- **EVM**: 20-byte hexadecimal addresses (0x + 40 chars)
- **Solana**: 32-byte base58 encoded public keys
- **Tron**: 21-byte addresses in base58 format (starting with 'T')

This diversity creates challenges:
- Type safety issues when handling multiple chains
- Complex validation logic scattered throughout code
- Difficulty in storing addresses in a unified database schema
- Error-prone conversions between formats

### The Solution
Universal Addresses solve these problems by:
- Providing a single, consistent 32-byte format
- Enabling type-safe operations across chains
- Centralizing conversion and validation logic
- Simplifying database storage and querying

## Technical Implementation

### Format Specification
```
Universal Address = 0x + 64 hexadecimal characters (32 bytes)
```

### Type Definition
```typescript
// Branded type for compile-time safety
export type UniversalAddress = string & { 
  readonly __brand: 'UniversalAddress' 
};
```

The branded type ensures that:
- Regular strings cannot be used where UniversalAddress is expected
- Type checking catches format errors at compile time
- Explicit conversion is required, preventing accidents

## Address Normalization

### EVM Addresses (20 bytes → 32 bytes)
```typescript
// Original EVM address (20 bytes)
const evmAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8";

// Normalized (padded with 12 leading zero bytes)
const normalized = "0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb8";
```

**Process:**
1. Validate EVM address format
2. Convert to lowercase (checksummed)
3. Pad with 24 leading zeros (12 bytes)
4. Prefix with 0x

### Solana Addresses (32 bytes → 32 bytes)
```typescript
// Original Solana address (base58)
const solanaAddress = "11111111111111111111111111111112";

// Normalized (already 32 bytes, just convert encoding)
const normalized = "0x0000000000000000000000000000000000000000000000000000000000000001";
```

**Process:**
1. Decode base58 to bytes
2. Verify 32-byte length
3. Convert to hexadecimal
4. Prefix with 0x

### Tron Addresses (21 bytes → 32 bytes)
```typescript
// Original Tron address (base58)
const tronAddress = "TLjfbTbpZYDQ6KqsvEkgKdDmqmX5vEt3Vr";

// Normalized (padded with 11 leading zero bytes)
const normalized = "0x00000000000000000000004174dc0a85dd960d0db1bb65c70e2a36bbb957c5ab";
```

**Process:**
1. Decode base58 to hex
2. Verify 21-byte format (starts with 0x41)
3. Pad with 22 leading zeros (11 bytes)
4. Prefix with 0x

## Usage Guide

### Basic Operations

#### Creating a Universal Address
```typescript
import { toUniversalAddress, isUniversalAddress } from '@/common/types/universal-address.type';

// From a normalized string
const addr = toUniversalAddress("0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb8");

// Validate format
if (isUniversalAddress(someString)) {
  // Safe to use as UniversalAddress
  const universal = someString as UniversalAddress;
}
```

#### Normalizing Chain-Specific Addresses
```typescript
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';

// Normalize EVM address
const evmUniversal = AddressNormalizer.normalize(
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
  ChainType.EVM
);

// Normalize Solana address
const solanaUniversal = AddressNormalizer.normalize(
  "11111111111111111111111111111112",
  ChainType.SVM
);

// Normalize Tron address
const tronUniversal = AddressNormalizer.normalize(
  "TLjfbTbpZYDQ6KqsvEkgKdDmqmX5vEt3Vr",
  ChainType.TVM
);
```

#### Denormalizing to Chain-Specific Format
```typescript
// Back to EVM format
const evmAddress = AddressNormalizer.denormalize(
  universalAddress,
  ChainType.EVM
);
// Result: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8"

// Back to Solana format
const solanaAddress = AddressNormalizer.denormalize(
  universalAddress,
  ChainType.SVM
);
// Result: "11111111111111111111111111111112"

// Back to Tron format
const tronAddress = AddressNormalizer.denormalize(
  universalAddress,
  ChainType.TVM
);
// Result: "TLjfbTbpZYDQ6KqsvEkgKdDmqmX5vEt3Vr"
```

### Integration Examples

#### In Intent Processing
```typescript
interface Intent {
  reward: {
    prover: UniversalAddress;    // Chain-agnostic
    creator: UniversalAddress;   // Chain-agnostic
    // ...
  };
  route: {
    portal: UniversalAddress;     // Chain-agnostic
    tokens: Array<{
      token: UniversalAddress;   // Chain-agnostic
      amount: bigint;
    }>;
    // ...
  };
}
```

#### In Blockchain Services
```typescript
class BlockchainReaderService {
  async getBalance(
    address: UniversalAddress,  // Accept universal format
    chainId: bigint
  ): Promise<bigint> {
    const chainType = ChainTypeDetector.detectFromChainId(chainId);
    
    // Convert to chain-specific format for RPC call
    const nativeAddress = AddressNormalizer.denormalize(
      address,
      chainType
    );
    
    // Make chain-specific call
    const reader = this.getReader(chainId);
    return reader.getBalance(nativeAddress);
  }
}
```

#### In Database Storage
```typescript
// MongoDB schema stores universal format
const TokenSchema = new Schema({
  address: {
    type: String,  // Universal format
    required: true,
    validate: {
      validator: isUniversalAddress,
      message: 'Invalid universal address format'
    }
  },
  chainId: String,
  symbol: String,
  decimals: Number
});
```

## Chain Detection

The system can automatically detect chain type from chain IDs:

```typescript
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';

const chainType = ChainTypeDetector.detectFromChainId(1n); // EVM
const chainType = ChainTypeDetector.detectFromChainId(1001n); // SVM (Solana)
const chainType = ChainTypeDetector.detectFromChainId(195n); // TVM (Tron)
```

## Benefits

### 1. Type Safety
```typescript
// Compile-time error prevention
function processAddress(addr: UniversalAddress) {
  // ...
}

const rawAddress = "0x742d...";
processAddress(rawAddress); // ❌ Type error!

const universal = AddressNormalizer.normalize(rawAddress, ChainType.EVM);
processAddress(universal); // ✅ Type safe!
```

### 2. Unified Storage
```typescript
// Single column/field for all chain addresses
{
  tokenAddress: "0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beb8",
  chainId: "1" // Ethereum
}
{
  tokenAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
  chainId: "1001" // Solana
}
```

### 3. Simplified Logic
```typescript
// No need for chain-specific handling in business logic
async function validateTokenBalance(
  token: UniversalAddress,
  owner: UniversalAddress,
  requiredAmount: bigint,
  chainId: bigint
): Promise<boolean> {
  const balance = await blockchainReader.getTokenBalance(
    token,
    owner,
    chainId
  );
  return balance >= requiredAmount;
}
```

### 4. Cross-Chain Compatibility
```typescript
// Same address format works across all chains
const intent: Intent = {
  reward: {
    creator: universalAddress, // Works on any chain
    // ...
  },
  route: {
    source: 1n,      // Ethereum
    destination: 1001n, // Solana
    // Addresses work on both chains
  }
};
```

## Error Handling

### Common Errors

#### Invalid Format
```typescript
try {
  const addr = toUniversalAddress("invalid");
} catch (error) {
  // Error: Invalid normalized address format: invalid. 
  // Expected 0x + 64 hex characters
}
```

#### Invalid Chain Type
```typescript
try {
  const normalized = AddressNormalizer.normalize(
    address,
    'unknown' as ChainType
  );
} catch (error) {
  // Error: Unsupported chain type: unknown
}
```

#### Denormalization Failure
```typescript
try {
  const evmAddr = AddressNormalizer.denormalizeToEvm(
    invalidUniversal
  );
} catch (error) {
  // Error: Invalid EVM address after denormalization
}
```

## Best Practices

### 1. Always Validate Input
```typescript
// Validate before normalization
if (!isValidEvmAddress(input)) {
  throw new Error('Invalid EVM address');
}
const universal = AddressNormalizer.normalize(input, ChainType.EVM);
```

### 2. Use Type Guards
```typescript
function processAddress(addr: unknown) {
  if (!isUniversalAddress(addr)) {
    throw new Error('Expected UniversalAddress');
  }
  // addr is now typed as UniversalAddress
}
```

### 3. Store Universal Format
```typescript
// Always store universal format in database
const dbRecord = {
  address: AddressNormalizer.normalize(userInput, chainType),
  originalFormat: userInput, // Optional: keep original for reference
  chainType: chainType
};
```

### 4. Convert at Boundaries
```typescript
// Convert at system boundaries (input/output)
class TokenController {
  @Post('/transfer')
  async transfer(@Body() dto: TransferDto) {
    // Convert input to universal
    const universal = AddressNormalizer.normalize(
      dto.recipient,
      ChainType.EVM
    );
    
    // Process with universal format
    await this.service.transfer(universal, dto.amount);
    
    // Convert back for response
    return {
      recipient: AddressNormalizer.denormalize(
        universal,
        ChainType.EVM
      )
    };
  }
}
```

## Testing

### Unit Testing
```typescript
describe('UniversalAddress', () => {
  it('should normalize EVM address', () => {
    const evm = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8';
    const universal = AddressNormalizer.normalize(evm, ChainType.EVM);
    
    expect(isUniversalAddress(universal)).toBe(true);
    expect(universal).toHaveLength(66); // 0x + 64 chars
  });
  
  it('should round-trip correctly', () => {
    const original = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8';
    const universal = AddressNormalizer.normalize(original, ChainType.EVM);
    const restored = AddressNormalizer.denormalize(universal, ChainType.EVM);
    
    expect(restored.toLowerCase()).toBe(original.toLowerCase());
  });
});
```

### Integration Testing
```typescript
it('should handle cross-chain intent', async () => {
  const intent: Intent = {
    reward: {
      creator: AddressNormalizer.normalize(evmAddress, ChainType.EVM),
      prover: AddressNormalizer.normalize(solanaAddress, ChainType.SVM),
      // ...
    },
    route: {
      source: 1n,  // Ethereum
      destination: 1001n, // Solana
      // ...
    }
  };
  
  const result = await fulfillmentService.submitIntent(intent);
  expect(result.status).toBe('pending');
});
```

## Migration Guide

### Converting Existing Code

#### Step 1: Update Types
```typescript
// Before
interface Token {
  address: string;
  evmAddress?: string;
  solanaAddress?: string;
}

// After
interface Token {
  address: UniversalAddress;
}
```

#### Step 2: Update Validation
```typescript
// Before
function validateAddress(address: string, chainType: string) {
  if (chainType === 'evm') return isEvmAddress(address);
  if (chainType === 'solana') return isSolanaAddress(address);
  // ...
}

// After
function validateAddress(address: UniversalAddress) {
  return isUniversalAddress(address);
}
```

#### Step 3: Update Storage
```typescript
// Before: Multiple columns
CREATE TABLE tokens (
  evm_address VARCHAR(42),
  solana_address VARCHAR(44),
  tron_address VARCHAR(34)
);

// After: Single column
CREATE TABLE tokens (
  address CHAR(66) -- Universal format
);
```

## Troubleshooting

### Address Too Long
```
Error: Address too long to pad: 0x... Maximum 32 bytes allowed
```
**Solution**: Verify the input address format is correct for the chain type.

### Invalid Normalized Format
```
Error: Invalid normalized address format: ... Expected 0x + 64 hex characters
```
**Solution**: Ensure the address is properly normalized before using `toUniversalAddress()`.

### Chain Type Detection Failed
```
Error: Unknown chain ID: ...
```
**Solution**: Add the chain ID to the ChainTypeDetector configuration.

### Denormalization Failed
```
Error: Invalid EVM address after denormalization: ...
```
**Solution**: Verify the universal address was created from a valid chain-specific address.