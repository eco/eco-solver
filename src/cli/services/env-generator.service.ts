import { Injectable, Logger } from '@nestjs/common';

import { ConfigFactory } from '@/config/config-factory';
import { pathToEnvVar } from '@/modules/config/utils/schema-transformer';

import { ConfigTraverser } from '../utils/config-traverser';
import { getSpecialCaseEnvVar } from '../utils/special-cases';
import { ValueSerializer } from '../utils/value-serializer';

export interface EnvEntry {
  name: string;
  value: string;
}

@Injectable()
export class EnvGeneratorService {
  private readonly logger = new Logger(EnvGeneratorService.name);
  private readonly traverser = new ConfigTraverser();
  private readonly serializer = new ValueSerializer();

  /**
   * Generates environment variable entries from current configuration.
   */
  public async generateEnvEntries(): Promise<EnvEntry[]> {
    this.logger.log('Loading configuration...');
    const config = await ConfigFactory.loadConfig();

    this.logger.log('Traversing configuration object...');
    const entries = this.traverser.traverse(config);

    this.logger.log(`Found ${entries.length} configuration values`);

    // Transform to environment variables
    const envEntries: EnvEntry[] = entries.map(({ path, value }) => {
      // Check special cases first
      const specialCase = getSpecialCaseEnvVar(path);
      const envVarName = specialCase || pathToEnvVar(path);

      // Serialize the value
      const serializedValue = this.serializer.serialize(value);
      const formattedValue = this.serializer.format(serializedValue);

      return { name: envVarName, value: formattedValue };
    });

    // Sort alphabetically by name
    envEntries.sort((a, b) => a.name.localeCompare(b.name));

    this.logger.log(`Generated ${envEntries.length} environment variables`);
    return envEntries;
  }

  /**
   * Generates .env file content from environment variable entries.
   */
  public generateEnvFileContent(entries: EnvEntry[]): string {
    const lines = entries.map(({ name, value }) => `${name}=${value}`);
    return lines.join('\n') + '\n'; // Add trailing newline
  }
}
