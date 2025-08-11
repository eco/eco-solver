export interface NestRedlockConfigFactory {
  createNestRedlockConfig(): Promise<NestRedlockConfig> | NestRedlockConfig
}
