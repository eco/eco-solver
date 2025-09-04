import axios, { AxiosInstance, AxiosResponse } from 'axios'

export interface TronEnergyProvider {
  name: string
  rentEnergy(params: RentEnergyParams): Promise<RentEnergyResponse>
  estimateEnergyPrice(params: EstimateEnergyParams): Promise<EstimateEnergyResponse>
  getEnergyRate(): Promise<EnergyRateResponse>
}

export interface RentEnergyParams {
  receiverAddress: string
  amount: number
  resourceType?: 'ENERGY' | 'BANDWIDTH'
  period?: number
}

export interface RentEnergyResponse {
  success: boolean
  txHash?: string
  orderId?: string
  error?: string
  energyRented?: number
}

export interface EstimateEnergyParams {
  to: string
  data?: string
  from?: string
  value?: string
}

export interface EstimateEnergyResponse {
  energyRequired: number
  success: boolean
  error?: string
}

export interface EstimateBandwidthResponse {
  bandwidthRequired: number
  success: boolean
  error?: string
}

export interface EnergyRateResponse {
  trxPerEnergy: number
  success: boolean
  error?: string
}

export interface EstimateCostParams {
  transaction: any
  to?: string
  data?: string
  from?: string
  value?: string
}

export interface TrxPriceResponse {
  usdtPrice: number
  success: boolean
  error?: string
  source?: string
}

export interface TronEnergyBalance {
  address: string
  energy: number
  bandwidth?: number
}

class NettsProvider implements TronEnergyProvider {
  public name = 'Netts'
  private client: AxiosInstance

  constructor(private apiKey: string, private baseUrl: string = 'https://api.netts.io') {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
  }

  async rentEnergy(params: RentEnergyParams): Promise<RentEnergyResponse> {
    return {
      success: false,
      error: 'Netts API implementation not yet completed - requires actual API documentation',
    }
  }

  async estimateEnergyPrice(params: EstimateEnergyParams): Promise<EstimateEnergyResponse> {
    return {
      energyRequired: 0,
      success: false,
      error: 'Netts API implementation not yet completed - requires actual API documentation',
    }
  }

  async getEnergyRate(): Promise<EnergyRateResponse> {
    return {
      trxPerEnergy: 0,
      success: false,
      error: 'Netts API implementation not yet completed - requires actual API documentation',
    }
  }
}

class CatfeeProvider implements TronEnergyProvider {
  public name = 'Catfee'
  private client: AxiosInstance

  constructor(private apiKey: string, private baseUrl: string = 'https://api.catfee.com') {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
  }

  async rentEnergy(params: RentEnergyParams): Promise<RentEnergyResponse> {
    return {
      success: false,
      error: 'Catfee API implementation not yet completed - requires actual API documentation',
    }
  }

  async estimateEnergyPrice(params: EstimateEnergyParams): Promise<EstimateEnergyResponse> {
    return {
      energyRequired: 0,
      success: false,
      error: 'Catfee API implementation not yet completed - requires actual API documentation',
    }
  }

  async getEnergyRate(): Promise<EnergyRateResponse> {
    return {
      trxPerEnergy: 0,
      success: false,
      error: 'Catfee API implementation not yet completed - requires actual API documentation',
    }
  }
}

export class TronEnergyRental {
  private providers: TronEnergyProvider[] = []
  private tronWeb: any

  constructor(
    nettsApiKey?: string,
    catfeeApiKey?: string,
    tronWebInstance?: any,
  ) {
    if (nettsApiKey) {
      this.providers.push(new NettsProvider(nettsApiKey))
    }
    
    if (catfeeApiKey) {
      this.providers.push(new CatfeeProvider(catfeeApiKey))
    }

    if (this.providers.length === 0) {
      throw new Error('At least one energy rental provider must be configured')
    }

    this.tronWeb = tronWebInstance
  }

  async rentEnergy(params: RentEnergyParams): Promise<RentEnergyResponse> {
    for (const provider of this.providers) {
      try {
        const result = await provider.rentEnergy(params)
        if (result.success) {
          return result
        }
      } catch (error) {
        console.warn(`Energy rental failed with ${provider.name}:`, error)
        continue
      }
    }

    return {
      success: false,
      error: 'All energy rental providers failed',
    }
  }

  async getEnergyBalance(address: string): Promise<number> {
    if (!this.tronWeb) {
      throw new Error('TronWeb instance required for balance checking')
    }

    try {
      const account = await this.tronWeb.trx.getAccount(address)
      return account.account_resource?.energy_limit || 0
    } catch (error) {
      console.error('Failed to get energy balance:', error)
      return 0
    }
  }

  async rentEnergyIfNeeded(params: {
    receiverAddress: string
    requiredEnergy: number
    resourceType?: 'ENERGY' | 'BANDWIDTH'
    period?: number
  }): Promise<RentEnergyResponse> {
    const currentBalance = await this.getEnergyBalance(params.receiverAddress)
    const energyNeeded = Math.max(0, params.requiredEnergy - currentBalance)

    if (energyNeeded === 0) {
      return {
        success: true,
        energyRented: 0,
      }
    }

    return this.rentEnergy({
      receiverAddress: params.receiverAddress,
      amount: energyNeeded,
      resourceType: params.resourceType,
      period: params.period,
    })
  }

  async estimateTransactionEnergy(params: EstimateEnergyParams): Promise<EstimateEnergyResponse> {
    if (!this.tronWeb) {
      return this.estimateEnergyUsingProviders(params)
    }

    try {
      const estimate = await this.tronWeb.transactionBuilder.estimateEnergy(
        params.to,
        params.from || this.tronWeb.defaultAddress?.hex,
        params.data || '0x',
        params.value ? this.tronWeb.toSun(params.value) : 0
      )

      return {
        energyRequired: estimate.energy_required || 0,
        success: true,
      }
    } catch (error) {
      console.warn('estimateEnergy failed, trying triggerConstantContract fallback:', error)
      
      try {
        const constantResult = await this.tronWeb.transactionBuilder.triggerConstantContract(
          params.to,
          params.data || '0x',
          { from: params.from },
          []
        )

        return {
          energyRequired: constantResult.energy_used || 21000,
          success: true,
        }
      } catch (fallbackError) {
        console.warn('triggerConstantContract also failed, using provider estimates:', fallbackError)
        return this.estimateEnergyUsingProviders(params)
      }
    }
  }

  private async estimateEnergyUsingProviders(params: EstimateEnergyParams): Promise<EstimateEnergyResponse> {
    for (const provider of this.providers) {
      try {
        const result = await provider.estimateEnergyPrice(params)
        if (result.success) {
          return result
        }
      } catch (error) {
        console.warn(`Energy estimation failed with ${provider.name}:`, error)
        continue
      }
    }

    return {
      energyRequired: 21000,
      success: false,
      error: 'All estimation methods failed, using default estimate',
    }
  }

  estimateBandwidth(transaction: any): EstimateBandwidthResponse {
    try {
      let rawDataHex = ''
      
      if (typeof transaction === 'string') {
        rawDataHex = transaction.startsWith('0x') ? transaction.slice(2) : transaction
      } else if (transaction.raw_data_hex) {
        rawDataHex = transaction.raw_data_hex
      } else if (transaction.rawData) {
        rawDataHex = Buffer.from(JSON.stringify(transaction.rawData)).toString('hex')
      } else {
        rawDataHex = Buffer.from(JSON.stringify(transaction)).toString('hex')
      }

      const signatures = transaction.signature ? transaction.signature.length : 1
      const bandwidthRequired = (rawDataHex.length / 2) + (65 * signatures)

      return {
        bandwidthRequired: Math.ceil(bandwidthRequired),
        success: true,
      }
    } catch (error: any) {
      return {
        bandwidthRequired: 0,
        success: false,
        error: error.message,
      }
    }
  }

  async getEnergyRate(): Promise<EnergyRateResponse> {
    for (const provider of this.providers) {
      try {
        const result = await provider.getEnergyRate()
        if (result.success) {
          return result
        }
      } catch (error) {
        console.warn(`Energy rate fetch failed with ${provider.name}:`, error)
        continue
      }
    }

    return {
      trxPerEnergy: 0,
      success: false,
      error: 'All energy rate providers failed',
    }
  }

  async estimateCost(params: EstimateCostParams): Promise<number> {
    if (!this.tronWeb) {
      throw new Error('TronWeb instance required for cost estimation')
    }

    try {
      const energyEstimate = await this.estimateTransactionEnergy({
        to: params.to || '',
        data: params.data,
        from: params.from,
        value: params.value,
      })

      const bandwidthEstimate = this.estimateBandwidth(params.transaction)

      const energyRate = await this.getEnergyRate()

      const bandwidthPrices = await this.tronWeb.trx.getBandwidthPrices()

      if (!energyEstimate.success || !bandwidthEstimate.success || !energyRate.success) {
        throw new Error('Failed to get required estimates for cost calculation')
      }

      const energyCostTrx = energyEstimate.energyRequired * energyRate.trxPerEnergy
      const bandwidthCostTrx = bandwidthEstimate.bandwidthRequired * (bandwidthPrices.bandwidth_price || bandwidthPrices.price || 0.001)

      return energyCostTrx + bandwidthCostTrx
    } catch (error) {
      console.error('Cost estimation failed:', error)
      return 0
    }
  }

  async getTrxPriceInUsdt(): Promise<TrxPriceResponse> {
    const prices = await Promise.allSettled([
      this.fetchPriceFromCoinGecko(),
      this.fetchPriceFromBinance(),
    ])

    const validPrices: { price: number; source: string }[] = []

    prices.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        validPrices.push({
          price: result.value.usdtPrice,
          source: index === 0 ? 'CoinGecko' : 'Binance',
        })
      }
    })

    if (validPrices.length === 0) {
      return {
        usdtPrice: 0,
        success: false,
        error: 'All price sources failed',
      }
    }

    const bestPrice = validPrices.reduce((max, current) => 
      current.price > max.price ? current : max
    )

    return {
      usdtPrice: bestPrice.price,
      success: true,
      source: bestPrice.source,
    }
  }

  private async fetchPriceFromCoinGecko(): Promise<TrxPriceResponse> {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usdt',
        { timeout: 5000 }
      )

      return {
        usdtPrice: response.data.tron.usdt,
        success: true,
        source: 'CoinGecko',
      }
    } catch (error: any) {
      return {
        usdtPrice: 0,
        success: false,
        error: error.message,
        source: 'CoinGecko',
      }
    }
  }

  private async fetchPriceFromBinance(): Promise<TrxPriceResponse> {
    try {
      const response = await axios.get(
        'https://api.binance.com/api/v3/ticker/price?symbol=TRXUSDT',
        { timeout: 5000 }
      )

      return {
        usdtPrice: parseFloat(response.data.price),
        success: true,
        source: 'Binance',
      }
    } catch (error: any) {
      return {
        usdtPrice: 0,
        success: false,
        error: error.message,
        source: 'Binance',
      }
    }
  }

  async estimateCostInUsdt(params: EstimateCostParams): Promise<number> {
    try {
      const [trxCost, trxPrice] = await Promise.all([
        this.estimateCost(params),
        this.getTrxPriceInUsdt(),
      ])

      if (!trxPrice.success || trxCost === 0) {
        console.error('Failed to get TRX cost or price:', { trxCost, trxPrice })
        return 0
      }

      return trxCost * trxPrice.usdtPrice
    } catch (error) {
      console.error('USDT cost estimation failed:', error)
      return 0
    }
  }
}

export default TronEnergyRental