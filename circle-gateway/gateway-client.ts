import { Hex } from 'viem'

interface GatewayInfo {
  domains: Array<{
    chain: string
    network: string
    walletContract?: string
    minterContract?: string
  }>
}

interface BalanceSource {
  depositor: string
  domain: number
}

interface BalanceRequest {
  token: string
  sources: BalanceSource[]
}

interface Balance {
  domain: number
  balance: string
}

interface BalanceResponse {
  balances: Balance[]
}

type TransferResponse =
  | { message: string }
  | {
      attestation: Hex
      signature: Hex
      transferId: string
    }

export class GatewayClient {
  static readonly GATEWAY_API_BASE_URL = 'https://gateway-api-testnet.circle.com/v1'

  static readonly DOMAINS: Record<string, number> = {
    ethereum: 0,
    mainnet: 0,
    sepolia: 0,
    avalanche: 1,
    avalancheFuji: 1,
    base: 6,
    baseSepolia: 6,
  }

  static readonly CHAINS: Record<number, string> = {
    0: 'Ethereum',
    1: 'Avalanche',
    6: 'Base',
  }

  async info(): Promise<GatewayInfo> {
    return this.#get('/info')
  }

  async balances(token: string, depositor: string, domains?: number[]): Promise<BalanceResponse> {
    if (!domains) {
      domains = Object.keys(GatewayClient.CHAINS).map((d) => parseInt(d))
    }

    const request: BalanceRequest = {
      token,
      sources: domains.map((domain) => ({ depositor, domain })),
    }

    return this.#post('/balances', request)
  }

  async transfer(body: any): Promise<TransferResponse> {
    return this.#post('/transfer', body)
  }

  async #get<T>(path: string): Promise<T> {
    const url = GatewayClient.GATEWAY_API_BASE_URL + path
    const response = await fetch(url)
    return response.json() as Promise<T>
  }

  async #post<T>(path: string, body: unknown): Promise<T> {
    const url = GatewayClient.GATEWAY_API_BASE_URL + path
    const headers = { 'Content-Type': 'application/json' }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    })
    return response.json() as Promise<T>
  }
}
