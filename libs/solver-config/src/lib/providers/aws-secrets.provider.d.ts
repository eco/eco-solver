import { BaseConfigSource } from '../interfaces/config-source.interface';
export declare class AwsSecretsConfigProvider extends BaseConfigSource {
    private readonly awsProvider;
    private readonly awsCredentials;
    priority: number;
    name: string;
    constructor(awsProvider: any, awsCredentials: any[]);
    getConfig(): Promise<Record<string, any>>;
}
