import { Chain } from 'viem'
import { celo as vcelo } from 'viem/chains'

export const celo: Chain = {
  ...vcelo,
  rpcUrls: {
    default: {
      http: [`https://ancient-quaint-layer.celo-mainnet.quiknode.pro/{QUICKNODE_API_KEY}`],
      webSocket: [`wss://ancient-quaint-layer.celo-mainnet.quiknode.pro/{QUICKNODE_API_KEY}`],
    },
  },
}
