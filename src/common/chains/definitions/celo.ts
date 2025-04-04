import { Chain } from 'viem'
import { celo as vcelo } from 'viem/chains'

export const celo: Chain = {
  ...vcelo,
  rpcUrls: {
    default: {
      http: [`https://responsive-lingering-yard.celo-mainnet.quiknode.pro/{QUICKNODE_API_KEY}`],
      webSocket: [`wss://responsive-lingering-yard.celo-mainnet.quiknode.pro/{QUICKNODE_API_KEY}`],
    },
  },
}
