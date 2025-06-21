import { EstimatedGasData } from '@/transaction/smart-wallets/kernel/interfaces/estimated-gas-data.interface'

export interface EstimatedGasDataForIntentInitiation {
  gasCost: bigint
  estimations: EstimatedGasData[]
}
