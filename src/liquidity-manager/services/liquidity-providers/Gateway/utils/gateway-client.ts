import { Hex } from 'viem'
import { GatewayApiError } from '../gateway.errors'

export interface GatewayInfoDomain {
  chain: string
  network: string
  walletContract?: string
  minterContract?: string
  domain: number
}

export interface GatewayInfoResponse {
  domains: GatewayInfoDomain[]
}

export interface BalanceSource {
  depositor: string
  domain: number
}

export interface BalanceRequest {
  token: string
  sources: BalanceSource[]
}

export interface DomainBalance {
  domain: number
  balance: string
}

export interface BalanceResponse {
  balances: DomainBalance[]
}

// Encode API types (subset of the guide)
export type TokenSymbol = 'USDC' | 'EURC'

export interface EncodeRequest {
  token: TokenSymbol
  value: string // DecimalAmount
  allowDomainGrouping?: boolean
  destination: {
    domain: number
    recipient: string
    caller?: string
  }
  sources: Array<{
    domain: number
    value: string // DecimalAmount
    depositor: string
    signer?: string
    salt?: Hex
    hookData?: Hex
    maxBlockHeight?: string
    maxFee?: string
  }>
}

export type EIP712BurnIntent = {
  types: any
  domain: { name: 'GatewayWallet'; version: '1' }
  primaryType: 'BurnIntent'
  message: any
}

export type EIP712BurnIntentSet = {
  types: any
  domain: { name: 'GatewayWallet'; version: '1' }
  primaryType: 'BurnIntentSet'
  message: any
}

export type EncodeResponse =
  | { success: false; message: string }
  | {
      burnIntents: Array<{
        domain: number | number[]
        intent: Hex | EIP712BurnIntent | EIP712BurnIntentSet
        signer: string
      }>
    }

// Transfer API types (subset)
export interface TransferRequest {
  burnIntents: Array<{
    intent: Hex | EIP712BurnIntent | EIP712BurnIntentSet
    signer: string
    signature: Hex
  }>
}

export type TransferAttestationResponse =
  | { message: string }
  | { attestation: Hex; signature: Hex; transferId: string }

export class GatewayHttpClient {
  constructor(private readonly baseUrl: string) {}

  private headers() {
    return {
      'Content-Type': 'application/json',
    }
  }

  async getInfo(): Promise<GatewayInfoResponse> {
    const res = await fetch(new URL('/v1/info', this.baseUrl))
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new GatewayApiError('Gateway info failed', res.status, {
        endpoint: '/v1/info',
        body: text,
      })
    }
    return res.json()
  }

  async getBalances(req: BalanceRequest): Promise<BalanceResponse> {
    const res = await fetch(new URL('/v1/balances', this.baseUrl), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(req),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new GatewayApiError('Gateway balances failed', res.status, {
        endpoint: '/v1/balances',
        body: text,
      })
    }
    return res.json()
  }

  async encodeBurnIntents(payload: EncodeRequest): Promise<EncodeResponse> {
    const res = await fetch(new URL('/v1/encode', this.baseUrl), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new GatewayApiError('Gateway encode failed', res.status, {
        endpoint: '/v1/encode',
        body: text,
      })
    }
    return res.json()
  }

  async createTransferAttestation(payload: TransferRequest): Promise<TransferAttestationResponse> {
    const res = await fetch(new URL('/v1/transfers/attestations', this.baseUrl), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new GatewayApiError('Gateway attestation failed', res.status, {
        endpoint: '/v1/transfers/attestations',
        body: text,
      })
    }
    return res.json()
  }
}
