import { Chain } from 'viem'
import { celo as vcelo } from 'viem/chains'

export const celo: Chain = {
  ...vcelo,
  rpcUrls: {
    ...vcelo.rpcUrls,
    default: {
      http: [
        `https://ancient-quaint-layer.celo-mainnet.quiknode.pro/3cf3537c51ea8e4471cb435f4dabed1cf674dc53`,
        ...vcelo.rpcUrls.default.http,
      ],
      webSocket: [
        `wss://ancient-quaint-layer.celo-mainnet.quiknode.pro/3cf3537c51ea8e4471cb435f4dabed1cf674dc53`,
      ],
    },
  },
}
