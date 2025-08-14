export interface NestRedlockConfigFactory {
  createNestRedlockConfig(): Promise<any> | any
}