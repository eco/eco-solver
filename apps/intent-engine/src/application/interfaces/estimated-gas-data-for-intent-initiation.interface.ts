export interface EstimatedGasDataForIntentInitiation extends EstimatedGasData {
  gasEstimate: bigint
  gasPrice: bigint
  gasCost: bigint
}
