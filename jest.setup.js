/* eslint-disable no-console */
// Silence known harmless warnings
const originalWarn = console.warn
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('bigint: Failed to load bindings')) {
    return // Ignore
  }
  originalWarn(...args)
}

// Docker test configuration
// Set SKIP_DOCKER_TESTS=true to skip all Docker-dependent tests
// This is useful for CI environments or when Docker is not available
if (!process.env.SKIP_DOCKER_TESTS && process.env.CI === 'true') {
  console.log('Running in CI environment - Docker tests may be skipped based on availability')
}

// Add BigInt serialization support for Jest
// This prevents "Do not know how to serialize a BigInt" errors during test runs
BigInt.prototype.toJSON = function() {
  return this.toString()
}
