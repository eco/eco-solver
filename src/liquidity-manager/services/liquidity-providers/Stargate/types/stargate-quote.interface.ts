export interface StargateQuote {
  bridge: string // 'StargateV2Bridge:taxi'
  srcAddress: string // '0x0C0d18aa99B02946C70EAC6d47b8009b993c9BfF'
  dstAddress: string // '0x0C0d18aa99B02946C70EAC6d47b8009b993c9BfF'
  srcChainKey: string // 'ethereum'
  dstChainKey: string // 'polygon'
  error: unknown
  srcToken: string // '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  dstToken: string // '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
  srcAmount: string // '10000000'
  srcAmountMax: string // '74660843412'
  dstAmount: string // '9999749'
  dstAmountMin: string // '9000000'
  duration: {
    estimated: number // 180.828
  }
  allowance: string // '0'
  dstNativeAmount: string // '0'
  fees: {
    token: string // '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    amount: string // '26345818528554'
    type: string // 'message'
    chainKey: string // 'ethereum'
  }[]
  steps: StargateStep[]
}

export interface StargateStep {
  type: string // 'approve'
  sender: string // '0x0C0d18aa99B02946C70EAC6d47b8009b993c9BfF'
  chainKey: string // 'ethereum'
  transaction: {
    data: string // '0x095ea7b3000000000000000000000000c026395860db2d07ee33e05fe50ed7bd583189c70000000000000000000000000000000000000000000000000000000000989680'
    to: string // '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    from: string // '0x0C0d18aa99B02946C70EAC6d47b8009b993c9BfF'
  }
}
