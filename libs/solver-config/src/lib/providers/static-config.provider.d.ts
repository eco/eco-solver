import { BaseConfigSource } from '../interfaces/config-source.interface';
export declare class StaticConfigProvider extends BaseConfigSource {
    priority: number;
    name: string;
    getConfig(): Promise<Record<string, any>>;
}
