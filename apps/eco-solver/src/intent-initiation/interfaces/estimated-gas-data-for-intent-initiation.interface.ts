import { EstimatedGasData } from '@eco-solver/transaction/smart-wallets/kernel/interfaces/estimated-gas-data.interface'

export interface EstimatedGasDataForIntentInitiation extends EstimatedGasData {
  gasEstimate: bigint
  gasPrice: bigint
  gasCost: bigint
}
