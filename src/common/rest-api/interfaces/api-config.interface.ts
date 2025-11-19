export interface APIConfig {
  apiKey?: string;
  apiSecret?: string;
  apiPath?: string;
  passPhrase?: string;
  baseUrl: string;
  socketUrl?: string;
  addVersionToUrl?: boolean;
  idempotentIDHeader?: string;
  apiKeyHeader?: string;
  apiSecretHeader?: string;
}
