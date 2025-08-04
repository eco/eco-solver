import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import * as yaml from 'js-yaml';

/**
 * Loads configuration from YAML files
 * @param configPaths - Array of paths to YAML files (relative or absolute)
 * @returns Merged configuration object from all found files
 */
export function loadYamlConfig(configPaths?: string | string[]): Record<string, any> {
  if (!configPaths) return {};

  const paths = Array.isArray(configPaths) ? configPaths : [configPaths];
  let mergedConfig = {};

  for (const configPath of paths) {
    const absolutePath = resolveConfigPath(configPath);

    if (!existsSync(absolutePath)) {
      console.debug(`[YamlConfigLoader] Configuration file not found: ${absolutePath}`);
      continue;
    }

    try {
      const fileContent = readFileSync(absolutePath, 'utf8');
      const parsedConfig = yaml.load(fileContent) as Record<string, any>;

      if (parsedConfig && typeof parsedConfig === 'object') {
        console.log(`[YamlConfigLoader] Loaded configuration from: ${absolutePath}`);
        mergedConfig = { ...mergedConfig, ...parsedConfig };
      }
    } catch (error) {
      console.error(`[YamlConfigLoader] Failed to load configuration from ${absolutePath}:`, error);
    }
  }

  return mergedConfig;
}

/**
 * Resolves configuration file path
 * @param configPath - Relative or absolute path to config file
 * @returns Absolute path to the configuration file
 */
function resolveConfigPath(configPath: string): string {
  if (configPath.startsWith('/')) {
    return configPath;
  }

  // Resolve relative to project root (where package.json is)
  return join(process.cwd(), configPath);
}
