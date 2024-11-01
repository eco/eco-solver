import { Chain } from 'viem'
import { mantle as vmantle } from 'viem/chains'

export const mantle: Chain = {
  ...vmantle,
  rpcUrls: {
    ...vmantle.rpcUrls,
    alchemy: {
      http: ['https://mantle-mainnet.g.alchemy.com/v2'],
    },
  },
}
