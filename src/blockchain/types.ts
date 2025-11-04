export type ChainsResponse = Array<{
  chainName: string
  chainType: 'EVM' | 'SVM' | 'TVM'
  chainId: number
  tokens: {
    address: string
    decimals: number
    symbol: string
  }[]
  wallets: {
    type: 'kernel' | 'basic'
    address: string
  }[]
}>
