// Configuration service interface
export interface IConfigService {
  get<T>(key: string): T;
  set(key: string, value: any): void;
}