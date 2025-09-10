import axios, { AxiosInstance, AxiosResponse } from 'axios'
import * as crypto from 'crypto'
import { EventEmitter } from 'events'

export interface TronEnergyProvider {
  name: string
  rentEnergy(params: RentEnergyParams): Promise<RentEnergyResponse>
  estimateEnergyPrice(params: EstimateEnergyParams): Promise<EstimateEnergyResponse>
  getEnergyRate(): Promise<EnergyRateResponse>
}

export interface RentEnergyParams {
  receiverAddress: string
  amount: number
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

export interface AccountBalanceResponse {
  balance: number
  success: boolean
  error?: string
}

export interface TronEnergyBalance {
  address: string
  energy: number
  bandwidth?: number
}

class NettsProvider implements TronEnergyProvider {
  public name = 'Netts'
  private client: AxiosInstance

  constructor(private apiKey: string, private realIp: string, private baseUrl: string = 'https://netts.io') {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-API-KEY': this.apiKey,
        'X-Real-IP': this.realIp,
        'Content-Type': 'application/json',
      },
    })
  }

  async rentEnergy(params: RentEnergyParams): Promise<RentEnergyResponse> {
    try {
      const response: AxiosResponse = await this.client.post('/apiv2/order1h', {
        amount: params.amount,
        receiveAddress: params.receiverAddress,
      })

      return {
        success: true,
        txHash: response.data.txHash,
        orderId: response.data.orderId,
        energyRented: response.data.energy || params.amount,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      }
    }
  }

  async estimateEnergyPrice(params: EstimateEnergyParams): Promise<EstimateEnergyResponse> {
    try {
      const response: AxiosResponse = await this.client.get(`/apiv2/usdt/${params.from}&${params.to}`)
      
      return {
        energyRequired: response.data.energyNeeded || response.data.recommendedEnergy || 0,
        success: true,
      }
    } catch (error: any) {
      return {
        energyRequired: 0,
        success: false,
        error: error.response?.data?.error || error.message,
      }
    }
  }

  async getEnergyRate(): Promise<EnergyRateResponse> {
    try {
      const response: AxiosResponse = await this.client.get('/apiv2/prices')
      
      const activePeriod = response.data.periods.find((period: any) => period.is_active)
      
      if (!activePeriod) {
        throw new Error('No active pricing period found')
      }
      
      const priceInSun = activePeriod.prices.less_than_200k?.price_sun || 
                        activePeriod.prices.equal_131k?.price_sun ||
                        activePeriod.prices.more_than_200k?.price_sun ||
                        17
      
      const trxPerEnergy = priceInSun / 1000000
      
      return {
        trxPerEnergy,
        success: true,
      }
    } catch (error: any) {
      return {
        trxPerEnergy: 0,
        success: false,
        error: error.response?.data?.error || error.message,
      }
    }
  }
}

class CatfeeProvider implements TronEnergyProvider {
  public name = 'Catfee'
  private client: AxiosInstance

  constructor(private apiKey: string, private apiSecret: string, private parent?: TronEnergyRental, private baseUrl: string = 'https://api.catfee.io') {
    this.client = axios.create({
      baseURL: this.baseUrl,
    })
  }

  private generateSignature(timestamp: string, method: string, requestPath: string, body: string = ''): string {
    const message = timestamp + method + requestPath + body
    return crypto.createHmac('sha256', this.apiSecret).update(message).digest('base64')
  }

  private getAuthHeaders(method: string, path: string, body: string = ''): Record<string, string> {
    const timestamp = new Date().toISOString()
    const signature = this.generateSignature(timestamp, method, path, body)
    
    return {
      'CF-ACCESS-KEY': this.apiKey,
      'CF-ACCESS-SIGN': signature,
      'CF-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
    }
  }

  async getAccountBalance(): Promise<AccountBalanceResponse> {
    try {
      const headers = this.getAuthHeaders('GET', '/v1/account')
      const response: AxiosResponse = await this.client.get('/v1/account', { headers })

      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Failed to get account balance')
      }

      return {
        balance: response.data.data?.balance || 0,
        success: true,
      }
    } catch (error: any) {
      return {
        balance: 0,
        success: false,
        error: error.response?.data?.msg || error.message,
      }
    }
  }

  async rentEnergy(params: RentEnergyParams): Promise<RentEnergyResponse> {
    try {
      const queryPath = `/v1/order?quantity=${Math.max(params.amount, 65000)}&receiver=${params.receiverAddress}&duration=1h`
      
      const headers = this.getAuthHeaders('POST', queryPath, '')
      
      const response: AxiosResponse = await this.client.post(queryPath, {}, { headers })

      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Order creation failed')
      }

      // Check balance after rental and auto-topup if needed
      const balanceCheck = await this.getAccountBalance()
      if (balanceCheck.success && balanceCheck.balance < 10) {
        console.warn(`⚠️  Catfee account balance is low: ${balanceCheck.balance} TRX (below 10 TRX threshold)`)
        
        if (this.parent) {
          const topupAmount = parseFloat(process.env.TOPUP_AMOUNT || '10')
          console.log(`🔄 Automatically topping up ${topupAmount} TRX to catfee account`)
          
          // Get user's TRX balance before transfer
          const userBalanceBefore = await this.parent['getUserTrxBalance']()
          
          // Attempt to top up
          const topupResult = await this.parent.topUpCatfee(topupAmount)
          
          if (topupResult.success) {
            console.log(`✅ Successfully topped up ${topupAmount} TRX to catfee account`)
            
            // Check user's balance after transfer
            const userBalanceAfter = await this.parent['getUserTrxBalance']()
            const balanceDrop = userBalanceBefore - userBalanceAfter
            
            // Emit event if user's balance dropped by the expected amount
            if (balanceDrop >= topupAmount - 0.1) { // Allow small tolerance for transaction fees
              this.parent.emit('balanceDeducted', {
                amount: balanceDrop,
                userBalanceBefore,
                userBalanceAfter,
                purpose: 'catfee_topup',
                txHash: topupResult.txHash
              })
              console.log(`📢 Emitted balanceDeducted event: user balance dropped by ${balanceDrop} TRX`)
            }
          } else {
            console.error(`❌ Failed to top up catfee account: ${topupResult.error}`)
          }
        }
      }

      return {
        success: true,
        txHash: response.data.data?.tx_hash || response.data.data?.txHash || response.data.data?.hash,
        orderId: response.data.data?.id || response.data.data?.order_id || response.data.data?.orderId,
        energyRented: response.data.data?.quantity || params.amount,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.msg || error.message,
      }
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
    try {
      const queryParams = '?quantity=65000&duration=1h'
      const headers = this.getAuthHeaders('GET', '/v1/estimate' + queryParams)
      
      const response: AxiosResponse = await this.client.get('/v1/estimate' + queryParams, { headers })

      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Price estimation failed')
      }

      const totalCostSun = response.data.data
      const totalCostTrx = totalCostSun / 1000000
      const quantity = 65000
      const trxPerEnergy = totalCostTrx / quantity

      return {
        trxPerEnergy,
        success: true,
      }
    } catch (error: any) {
      return {
        trxPerEnergy: 0,
        success: false,
        error: error.response?.data?.msg || error.message,
      }
    }
  }
}

export class TronEnergyRental extends EventEmitter {
  private providers: TronEnergyProvider[] = []
  private tronWeb: any

  constructor(
    nettsApiKey?: string,
    catfeeApiKey?: string,
    tronWebInstance?: any,
    nettsRealIp?: string,
    catfeeApiSecret?: string,
  ) {
    super()
    // Prioritize catfee (more reliable) over netts
    if (catfeeApiKey) {
      if (!catfeeApiSecret) {
        throw new Error('CatfeeProvider requires both API key and API secret')
      }
      this.providers.push(new CatfeeProvider(catfeeApiKey, catfeeApiSecret, this))
    }
    
    if (nettsApiKey) {
      if (!nettsRealIp) {
        throw new Error('NettsProvider requires both API key and real IP address')
      }
      this.providers.push(new NettsProvider(nettsApiKey, nettsRealIp))
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

  private async getUserTrxBalance(): Promise<number> {
    if (!this.tronWeb) {
      return 0
    }

    try {
      const balance = await this.tronWeb.trx.getBalance()
      return this.tronWeb.fromSun(balance)
    } catch (error) {
      console.error('Failed to get user TRX balance:', error)
      return 0
    }
  }

  async topUpCatfee(trxAmount: number): Promise<{success: boolean, txHash?: string, error?: string}> {
    if (trxAmount < 10) {
      return {
        success: false,
        error: 'Minimum top-up amount is 10 TRX'
      }
    }

    if (!this.tronWeb) {
      return {
        success: false,
        error: 'TronWeb instance required for TRX transfers'
      }
    }

    if (!process.env.CATFEE_DEPOSIT_ADDRESS) {
      return {
        success: false,
        error: 'CATFEE_DEPOSIT_ADDRESS not found in environment variables'
      }
    }

    try {
      const trxAmountInSun = this.tronWeb.toSun(trxAmount)
      
      const transaction = await this.tronWeb.transactionBuilder.sendTrx(
        process.env.CATFEE_DEPOSIT_ADDRESS,
        trxAmountInSun
      )

      const signedTransaction = await this.tronWeb.trx.sign(transaction)
      const receipt = await this.tronWeb.trx.sendRawTransaction(signedTransaction)

      if (receipt.result) {
        console.log(`✅ Successfully topped up ${trxAmount} TRX to catfee account`)
        return {
          success: true,
          txHash: receipt.txid
        }
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error: any) {
      console.error('Catfee top-up failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default TronEnergyRental