import { Chain } from 'viem'
import { celo as vcelo } from 'viem/chains'

export const celo: Chain = {
  ...vcelo,
  rpcUrls: {
      ...vcelo.rpcUrls,
    alchemy: {
      http: ['https://celo-mainnet.g.alchemy.com/v2'],
    },
  },
}
