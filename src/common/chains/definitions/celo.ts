import { Chain } from 'viem'
import { celo as vcelo } from 'viem/chains'
import * as config from 'config'
import { QuicknodeConfigType } from '@/eco-configs/eco-config.types'

const { apiKey: quickNodeApiKey } = config.get<QuicknodeConfigType>('quicknode')

export const celo: Chain = {
  ...vcelo,
  rpcUrls: {
    default: {
      http: [`https://ancient-quaint-layer.celo-mainnet.quiknode.pro/{QUICKNODE_API_KEY}`],
      webSocket: [`wss://ancient-quaint-layer.celo-mainnet.quiknode.pro/{QUICKNODE_API_KEY}`],
    },
  },
}
