export interface RouteStep {
  type: 'sourceSwap' | 'cctpBridge' | 'destinationSwap'
  required: boolean
}

export class CCTPLiFiRoutePlanner {
  // Default USDC addresses for supported chains
  // These can be overridden by updateUSDCAddresses() but ensure the class is always usable
  private static DEFAULT_USDC_ADDRESSES: Record<number, Hex> = {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism
    137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum
    130: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', // Uni Chain
  }

  private static USDC_ADDRESSES: Record<number, Hex> = {
    ...CCTPLiFiRoutePlanner.DEFAULT_USDC_ADDRESSES,
  }

  /**
   * Updates the USDC addresses from config
   * @param usdcAddresses Map of chain ID to USDC address
   */
  static updateUSDCAddresses(usdcAddresses: Record<number, Hex>): void {
    CCTPLiFiRoutePlanner.USDC_ADDRESSES = { ...usdcAddresses }
  }

  /**
   * Gets the current USDC addresses (for testing or verification)
   * @returns Current USDC address configuration
   */
  static getUSDCAddresses(): Record<number, Hex> {
    return { ...CCTPLiFiRoutePlanner.USDC_ADDRESSES }
  }

  /**
   * Resets to default addresses (mainly for testing)
   */
  static resetToDefaults(): void {
    CCTPLiFiRoutePlanner.USDC_ADDRESSES = { ...CCTPLiFiRoutePlanner.DEFAULT_USDC_ADDRESSES }
  }

  /**
   * Plans the route steps needed for a CCTPLiFi operation
   * @param tokenIn Source token
   * @param tokenOut Destination token
   * @returns Array of required route steps
   */
  static planRoute(tokenIn: TokenData, tokenOut: TokenData): RouteStep[] {
    const sourceIsUSDC = this.isUSDC(tokenIn)
    const destinationIsUSDC = this.isUSDC(tokenOut)

    const steps: RouteStep[] = []

    // Step 1: Source chain swap (if needed)
    if (!sourceIsUSDC) {
      steps.push({ type: 'sourceSwap', required: true })
    }

    // Step 2: CCTP bridge (always required for cross-chain)
    steps.push({ type: 'cctpBridge', required: true })

    // Step 3: Destination chain swap (if needed)
    if (!destinationIsUSDC) {
      steps.push({ type: 'destinationSwap', required: true })
    }

    return steps
  }

  /**
   * Determines if a token is USDC on its respective chain
   * @param token Token to check
   * @returns True if token is USDC
   */
  static isUSDC(token: TokenData): boolean {
    const usdcAddress = this.USDC_ADDRESSES[token.chainId]
    if (!usdcAddress) {
      return false
    }
    return isAddressEqual(token.config.address as Hex, usdcAddress)
  }

  /**
   * Gets the USDC address for a given chain
   * @param chainId Chain ID
   * @returns USDC address for the chain
   */
  static getUSDCAddress(chainId: number): Hex {
    const usdcAddress = this.USDC_ADDRESSES[chainId]
    if (!usdcAddress) {
      throw new Error(`USDC address not found for chain ${chainId}`)
    }
    return usdcAddress
  }

  /**
   * Validates that both chains support CCTP
   * @param sourceChainId Source chain ID
   * @param destinationChainId Destination chain ID
   * @returns True if both chains support CCTP
   */
  static validateCCTPSupport(sourceChainId: number, destinationChainId: number): boolean {
    return (
      this.USDC_ADDRESSES[sourceChainId] !== undefined &&
      this.USDC_ADDRESSES[destinationChainId] !== undefined
    )
  }
}
