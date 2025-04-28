/* eslint-disable no-console */
// Silence known harmless warnings
const originalWarn = console.warn
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('bigint: Failed to load bindings')) {
    return // Ignore
  }
  originalWarn(...args)
}
