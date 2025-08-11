export class ChainValidationUtils {
  static validateChainSupport(chainID: number, supportedChains: number[]): boolean {
    return supportedChains.includes(chainID)
  }

  static validateChainID(chainID: number): boolean {
    return chainID > 0 && Number.isInteger(chainID)
  }

  static isMainnet(chainID: number): boolean {
    const mainnetChains = [1, 10, 42161, 8453, 137] // Ethereum, Optimism, Arbitrum, Base, Polygon
    return mainnetChains.includes(chainID)
  }

  static isTestnet(chainID: number): boolean {
    const testnetChains = [11155111, 11155420, 84532, 421614, 80001] // Sepolia, OP Sepolia, Base Sepolia, Arbitrum Sepolia, Mumbai
    return testnetChains.includes(chainID)
  }
}