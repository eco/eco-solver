import { writeFileSync } from 'fs';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { Command } from 'commander';

import { ConfigFactory } from '@/config/config-factory';

import { EnvGeneratorService } from './services/env-generator.service';
import { CliModule } from './cli.module';

class ConfigToEnvCLI {
  private readonly logger = new Logger(ConfigToEnvCLI.name);
  private readonly program = new Command();

  constructor() {
    this.setupCommands();
  }

  private setupCommands() {
    this.program
      .name('config-to-env')
      .description('Generate .env file from current configuration')
      .version('1.0.0')
      .option('-o, --output <file>', 'Output file path', '.env')
      .action(async (options) => {
        try {
          await this.generateEnvFile(options.output);
          process.exit(0);
        } catch (error) {
          this.logger.error('Failed to generate .env file', error);
          process.exit(1);
        }
      });
  }

  private async generateEnvFile(outputPath: string): Promise<void> {
    this.logger.log('Creating NestJS application context...');

    // Create application context
    const app = await NestFactory.createApplicationContext(CliModule, {
      logger: ['error', 'warn', 'log'],
    });

    try {
      // Load configuration explicitly
      this.logger.log('Loading configuration...');
      await ConfigFactory.loadConfig();

      // Get generator service
      const generatorService = app.get(EnvGeneratorService);

      // Generate environment variables
      this.logger.log('Generating environment variables...');
      const envEntries = await generatorService.generateEnvEntries();

      // Generate .env file content
      const envContent = generatorService.generateEnvFileContent(envEntries);

      // Write to file
      this.logger.log(`Writing to ${outputPath}...`);
      writeFileSync(outputPath, envContent, 'utf-8');

      this.logger.log(`Successfully generated ${outputPath} with ${envEntries.length} variables`);
    } finally {
      await app.close();
    }
  }

  public async run(): Promise<void> {
    await this.program.parseAsync(process.argv);
  }
}

// Execute CLI if run directly
if (require.main === module) {
  const cli = new ConfigToEnvCLI();
  cli.run().catch((error) => {
    console.error('CLI execution failed:', error);
    process.exit(1);
  });
}
