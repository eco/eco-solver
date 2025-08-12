/**
 * Jest setup file to handle BigInt serialization issues
 */

// Add BigInt serialization support for Jest
Object.defineProperty(BigInt.prototype, 'toJSON', {
  value: function () {
    return this.toString() + 'n'
  },
  configurable: true,
})

// Optionally, you can also add custom matchers or global test utilities here
