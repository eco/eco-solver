import { Hex } from 'viem'

export type AtomicKeyParams = {
  address: Hex
  chainId: number
}

export function getAtomicNonceVals(key: string): AtomicKeyParams {
  const [address, chainIdStr] = key.split('.')
  return {
    address: address as Hex,
    chainId: parseInt(chainIdStr, 10)
  }
}

export function getAtomicNonceKey(params: AtomicKeyParams): string {
  return `${params.address}.${params.chainId}`
}