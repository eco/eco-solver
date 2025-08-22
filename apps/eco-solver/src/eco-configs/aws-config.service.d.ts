import { OnModuleInit } from '@nestjs/common';
import { ConfigSource } from './interfaces/config-source.interface';
/**
 * Service to retrieve AWS secrets from AWS Secrets Manager
 */
export declare class AwsConfigService implements OnModuleInit, ConfigSource {
    private logger;
    private _awsConfigs;
    onModuleInit(): Promise<void>;
    /**
     * @returns the aws configs
     */
    getConfig(): Record<string, string>;
    /**
     * Initialize the configs
     */
    initConfigs(): Promise<void>;
    get awsConfigs(): Record<string, string>;
    /**
     * Retrieve the AWS secrets from the AWS Secrets Manager
     * @param awsCreds the aws credentials
     * @returns
     */
    private getAwsSecrets;
}
