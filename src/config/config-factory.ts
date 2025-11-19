import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { z } from 'zod';

import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { ModuleRefProvider } from '@/common/services/module-ref-provider';
import { AwsSchema, BaseSchema, Config, ConfigSchema } from '@/config/config.schema';
import { AwsConfig } from '@/config/schemas';
import { getEcoNpmPackageConfig } from '@/config/utils/eco-package';
import { mergeWithArrayReplacement } from '@/config/utils/merge.util';
import { loadYamlConfig } from '@/config/utils/yaml-config-loader';
import { EcoError } from '@/errors/eco-error';
import { AwsSecretsManager } from '@/modules/config/utils/aws-secrets-manager';
import { transformEnvVarsToConfig } from '@/modules/config/utils/schema-transformer';
import {
  ConfigurationChangeEvent,
  DynamicConfigService,
} from '@/modules/dynamic-config/services/dynamic-config.service';

/**
 * Configuration factory that transforms environment variables to configuration
 * and optionally merges AWS secrets and YAML configuration
 */
export class ConfigFactory {
  private static logger = new Logger(ConfigFactory.name);
  private static awsConfigValues: Record<string, any> = {};
  private static mongoConfig: Record<string, any> = {};
  private static cachedConfig: Config;
  private static configurationService: DynamicConfigService;
  private static eventEmitter: EventEmitter2;

  /**
   * Get all MongoDB configurations
   */
  static getMongoConfigurations(): Record<string, any> {
    return { ...this.mongoConfig };
  }

  /**
   * Check if MongoDB configuration integration is active
   */
  static isMongoConfigurationEnabled(): boolean {
    return Boolean(this.configurationService);
  }

  /**
   * Check if EventEmitter is enabled for configuration change events
   */
  static isEventEmitterEnabled(): boolean {
    return Boolean(this.eventEmitter);
  }

  /**
   * Get configuration source information for debugging
   */
  static getConfigurationSources(): {
    external: boolean;
    static: boolean;
    mongodb: boolean;
    mongoConfigCount: number;
  } {
    return {
      external: true, // this.sources.length > 0,
      static: true, // Always available
      mongodb: this.isMongoConfigurationEnabled(),
      mongoConfigCount: Object.keys(this.mongoConfig).length,
    };
  }

  static getConfig(): Config {
    if (!this.cachedConfig) {
      throw new Error('Configuration not loaded yet. Call loadConfig() first.');
    }

    return this.cachedConfig;
  }

  static async loadConfig(): Promise<Config> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `loadConfig`,
      }),
    );

    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // Transform all environment variables to nested configuration
    const envConfiguration = transformEnvVarsToConfig(process.env, ConfigSchema);

    // First merge to get the configFiles path from env vars if specified
    let mergedConfig = mergeWithArrayReplacement(envConfiguration);

    // Load YAML configuration if files are specified
    const { configFiles } = BaseSchema.parse(mergedConfig);
    const yamlConfiguration = loadYamlConfig(configFiles);

    // Merge in order: base defaults, YAML config, then environment vars (env vars take precedence)
    mergedConfig = mergeWithArrayReplacement(yamlConfiguration, envConfiguration);

    // Check if AWS secrets should be loaded
    mergedConfig = await this.loadAWSConfig(mergedConfig);

    // Check if NPM config should be loaded
    mergedConfig = await this.loadNPMConfig(mergedConfig);

    // Validate the final merged configuration
    this.cachedConfig = this.validateConfig(mergedConfig);
    return this.cachedConfig;
  }

  static async connectDynamicConfig() {
    const moduleRef = ModuleRefProvider.getModuleRef();
    this.configurationService = moduleRef?.get(DynamicConfigService, { strict: false });
    this.eventEmitter = moduleRef?.get(EventEmitter2, { strict: false });

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `${ConfigFactory.name}.connectDynamicConfig`,
        properties: {
          isMongoConfigurationEnabled: this.isMongoConfigurationEnabled(),
          haveEventEmitter: Boolean(this.isEventEmitterEnabled()),
        },
      }),
    );

    // Load MongoDB configurations if ConfigurationService is available
    if (!this.isMongoConfigurationEnabled()) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `MongoDB configuration integration not available, using static configurations only`,
        }),
      );

      return;
    }

    const result = await this.configurationService.getAll();
    this.mongoConfig = result.data.reduce(
      (acc, config) => {
        acc[config.key] = config.value;
        return acc;
      },
      {} as Record<string, any>,
    );

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `MongoDB configuration integration enabled. Loaded ${Object.keys(this.mongoConfig).length} configurations`,
      }),
    );

    // Re-merge configurations with MongoDB values
    this.mergeConfigurations();

    // Subscribe to configuration changes for reactive updates via EventEmitter
    this.subscribeToConfigChanges();
  }

  // Generic getter for key/val of config object
  static get<T>(key: string): T {
    return (this.cachedConfig as Record<string, any>)[key] as T;
  }

  static isRequestSignatureValidationEnabled(): boolean {
    return this.get<boolean>('requestSignatureValidationEnabled');
  }

  static getDynamicConfigAllowedAddresses(): string[] {
    return this.get<string[]>('dynamicConfigAllowedAddresses') || [];
  }

  static getAWSConfigValues(): Record<string, any> {
    return this.awsConfigValues;
  }

  private static async loadAWSConfig(config: Record<string, any>): Promise<Record<string, any>> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `loadAWSConfig`,
        properties: {
          config: config.aws,
        },
      }),
    );

    // Check if AWS secrets should be loaded
    const useAwsSecrets = Boolean(config.aws?.secretName);

    if (useAwsSecrets) {
      const awsAccessConfig = AwsSchema.parse(config.aws);

      // Fetch secrets from AWS
      const secrets = await this.getAWSConfig(awsAccessConfig);
      this.awsConfigValues = secrets;

      // Merge AWS secrets into the configuration
      config = mergeWithArrayReplacement(secrets, config);
    }

    return config;
  }

  private static async getAWSConfig(awsAccessConfig: AwsConfig): Promise<Record<string, any>> {
    const awsSecretsService = new AwsSecretsManager();

    // Fetch secrets from AWS using the merged config
    return awsSecretsService.getSecrets(awsAccessConfig);
  }

  private static async loadNPMConfig(config: Record<string, any>): Promise<Record<string, any>> {
    // Check if NPM config should be loaded
    if (config.useEcoPackageConfig) {
      const npmPackageConfig = getEcoNpmPackageConfig(config);

      config = mergeWithArrayReplacement(config, npmPackageConfig);
    }

    return config;
  }

  /**
   * Merge configurations from all sources with proper priority:
   * 1. External configs (lowest priority)
   * 2. Static configs from config package (medium priority)
   * 3. MongoDB configs (highest priority)
   */
  private static mergeConfigurations() {
    // Start with external configs, then static configs, then MongoDB configs
    const savedConfig = this.cachedConfig;
    const merged = mergeWithArrayReplacement(this.cachedConfig, this.mongoConfig || {});
    try {
      this.cachedConfig = this.validateConfig(merged);
    } catch (ex) {
      EcoError.logError(ex, `Dynamic config validation failed; reverting merge`, this.logger);
      this.cachedConfig = savedConfig;
    }
  }

  private static subscribeToConfigChanges() {
    if (!this.isEventEmitterEnabled()) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `eventEmitter not available, cannot subscribe to config changes`,
        }),
      );

      return;
    }

    this.eventEmitter.on('configuration.changed', (event: ConfigurationChangeEvent) => {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Configuration updated from MongoDB: ${event.key}`,
        }),
      );

      if (event.operation === 'DELETE') {
        delete this.mongoConfig[event.key];
      } else {
        this.mongoConfig[event.key] = event.newValue;
      }

      this.mergeConfigurations();
    });
  }

  private static validateConfig(config: Record<string, any>): Config {
    try {
      // Parse and validate the complete merged configuration
      return ConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Convert Zod errors to a format similar to Joi
        const errorMessages = error.issues
          .map((issue) => {
            const path = issue.path.join('.');
            return `${path}: ${issue.message}`;
          })
          .join(', ');

        throw new Error(`Configuration validation error: ${errorMessages}`);
      }
      throw error;
    }
  }
}
