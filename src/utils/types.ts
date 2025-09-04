/**
 * The type of an array
 */
export type GetElementType<T> = T extends (infer U)[] ? U : never

/**
 * Removes the readonly modifier entire object
 */
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

/**
 * Removes the readonly modifier from a field
 */
export type MutableField<T, K extends keyof T> = Omit<T, K> & {
  -readonly [P in K]: T[P]
}

export { TronEnergyRental } from './tron-energy-rental'
export type { 
  TronEnergyProvider,
  RentEnergyParams,
  RentEnergyResponse,
  EstimateEnergyParams,
  EstimateEnergyResponse,
  EstimateBandwidthResponse,
  EnergyRateResponse,
  EstimateCostParams,
  TrxPriceResponse,
  TronEnergyBalance
} from './tron-energy-rental'
