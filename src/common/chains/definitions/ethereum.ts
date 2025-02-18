import { Chain } from 'viem'
import { mainnet as vmainnet, sepolia as vsepolia } from 'viem/chains'

export const ethereum: Chain = {
  ...vmainnet,
  rpcUrls: {
    ...vmainnet.rpcUrls,
    alchemy: {
      http: ['https://eth-mainnet.g.alchemy.com/v2'],
    },
  },
}

export const sepolia: Chain = {
  ...vsepolia,
  rpcUrls: {
    ...vsepolia.rpcUrls,
    alchemy: {
      http: ['https://eth-sepolia.g.alchemy.com/v2'],
    },
  },
}
