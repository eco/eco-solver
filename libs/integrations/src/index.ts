// Integrations library - minimal interface-only version
// This avoids TypeScript compilation issues with cross-library dependencies

// Core integration service interfaces
export interface IBlockchainService {
  getBalance(address: string, chainId: number): Promise<bigint>
  sendTransaction(transaction: any): Promise<string>
}

export interface IAnalyticsService {
  trackEvent(event: string, data: any): Promise<void>
}

export interface IConfigService {
  getConfig<T>(key: string): Promise<T>
}

export interface IAwsService {
  getSecrets(secretName: string): Promise<any>
}

export interface IDeFiService {
  getQuote(params: any): Promise<any>
}
