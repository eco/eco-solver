import { TokenData } from '@/liquidity-manager/types/types'
import { isAddressEqual, Hex } from 'viem'

export interface RouteStep {
  type: 'sourceSwap' | 'usdt0Bridge' | 'destinationSwap'
  required: boolean
}

export class USDT0LiFiRoutePlanner {
  private static USDT_ADDRESSES: Record<number, Hex> = {}

  static updateUSDTAddresses(usdtAddresses: Record<number, Hex>): void {
    this.USDT_ADDRESSES = { ...usdtAddresses }
  }

  static getUSDTAddress(chainId: number): Hex {
    const addr = this.USDT_ADDRESSES[chainId]
    if (!addr) throw new Error(`USDT address not found for chain ${chainId}`)
    return addr
  }

  static isUSDT(token: TokenData): boolean {
    const addr = this.USDT_ADDRESSES[token.chainId]
    if (!addr) return false
    return isAddressEqual(token.config.address as Hex, addr)
  }

  static validateUSDT0Support(sourceChainId: number, destinationChainId: number): boolean {
    return (
      this.USDT_ADDRESSES[sourceChainId] !== undefined &&
      this.USDT_ADDRESSES[destinationChainId] !== undefined
    )
  }

  static planRoute(tokenIn: TokenData, tokenOut: TokenData): RouteStep[] {
    const srcIsUSDT = this.isUSDT(tokenIn)
    const dstIsUSDT = this.isUSDT(tokenOut)

    const steps: RouteStep[] = []
    if (!srcIsUSDT) steps.push({ type: 'sourceSwap', required: true })
    steps.push({ type: 'usdt0Bridge', required: true })
    if (!dstIsUSDT) steps.push({ type: 'destinationSwap', required: true })
    return steps
  }
}
