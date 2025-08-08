/**
 * Jest setup file to handle BigInt serialization issues
 */

// Note: BigInt.prototype.toJSON was removed to allow custom serialization logic
// in src/common/utils/serialize.ts to work properly. The quote service tests
// now run with --maxWorkers=1 to avoid Jest worker serialization issues.

// Optionally, you can also add custom matchers or global test utilities here