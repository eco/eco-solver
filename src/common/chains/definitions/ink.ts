import { Chain } from 'viem'
import { ink as vink } from 'viem/chains'

export const ink: Chain = {
  ...vink,
  rpcUrls: {
    ...vink.rpcUrls,
    alchemy: {
      http: ['https://ink-mainnet.g.alchemy.com/v2'],
    },
  },
}
