import { Hex } from 'viem'

export function shortAddr(addr: Hex | string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
