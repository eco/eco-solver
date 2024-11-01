import { Chain } from 'viem'
import { arbitrum as varbitrum } from 'viem/chains'

export const arbitrum: Chain = {
  ...varbitrum,
  rpcUrls: {
    ...varbitrum.rpcUrls,
    alchemy: {
      http: ['https://arb-mainnet.g.alchemy.com/v2'],
    },
  },
}
