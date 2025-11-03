#!/usr/bin/env node

import { NestFactory } from '@nestjs/core'
import { ScriptModule } from './script.module'
import { AnalyzeFailedIntentsService } from './analyze-failed-intents.service'
import * as path from 'path'

/**
 * Script to analyze failed intents by extracting IntentRefunded events from transactions
 *
 * Input CSV format (no headers): chainID,transactionHash
 * Example:
 *   1,0x123abc...
 *   10,0x456def...
 *
 * The script:
 * 1. Reads chainID and transaction hash from CSV
 * 2. Fetches transaction receipts from RPC endpoint
 * 3. Extracts IntentRefunded events from receipts
 * 4. Queries MongoDB for intents by intent hashes
 * 5. Generates analysis CSV with intent details and error messages
 *
 * Required Environment Variables:
 *   MONGODB_URI     - MongoDB connection string (e.g., mongodb+srv://user:pass@host/db)
 *   ERPC_BASE_URL   - eRPC base URL
 *
 * Usage:
 *   MONGODB_URI=<mongo-uri> ts-node src/scripts/run-analyze-failed-intents.ts --input <input-file> [--output <output-file>]
 *
 * Arguments:
 *   --input, -i   Path to input CSV file with format: chainID,transactionHash (no headers)
 *   --output, -o  Path to output CSV file (optional, defaults to current directory with timestamp)
 *
 * Example:
 *   MONGODB_URI=mongodb://localhost:27017/ecosolver ts-node src/scripts/run-analyze-failed-intents.ts -i transactions.csv -o results.csv
 */

async function bootstrap() {
  // Parse command line arguments
  const args = process.argv.slice(2)
  let inputFile: string | undefined
  let outputFile: string | undefined

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--input' || args[i] === '-i') && i + 1 < args.length) {
      inputFile = args[i + 1]
      i++
    } else if ((args[i] === '--output' || args[i] === '-o') && i + 1 < args.length) {
      outputFile = args[i + 1]
      i++
    }
  }

  if (!inputFile) {
    console.error('Error: Input file is required')
    console.log('')
    console.log('Usage:')
    console.log(
      '  MONGODB_URI=<mongo-uri> ts-node src/scripts/run-analyze-failed-intents.ts --input <input-file> [--output <output-file>]',
    )
    console.log('')
    console.log('Required Environment Variables:')
    console.log('  MONGODB_URI     - MongoDB connection string')
    console.log(
      '  ERPC_BASE_URL   - eRPC base URL',
    )
    console.log('')
    console.log('Arguments:')
    console.log('  --input, -i   Path to input CSV file with format: chainID,transactionHash (no headers)')
    console.log(
      '  --output, -o  Path to output CSV file (optional, defaults to current directory with timestamp)',
    )
    console.log('')
    console.log('Input CSV format example:')
    console.log('  1,0x123abc...')
    console.log('  10,0x456def...')
    console.log('')
    console.log('Example:')
    console.log(
      '  MONGODB_URI=mongodb://localhost:27017/ecosolver ts-node src/scripts/run-analyze-failed-intents.ts -i transactions.csv -o results.csv',
    )
    process.exit(1)
  }

  // Resolve input file path
  const resolvedInputFile = path.resolve(process.cwd(), inputFile)
  const resolvedOutputFile = outputFile ? path.resolve(process.cwd(), outputFile) : undefined

  console.log('='.repeat(80))
  console.log('Analyze Failed Intents Script')
  console.log('='.repeat(80))
  console.log(`Input file:  ${resolvedInputFile}`)
  console.log(`Output file: ${resolvedOutputFile || '(auto-generated)'}`)
  console.log('='.repeat(80))
  console.log('')

  let app
  try {
    // Create NestJS application context
    console.log('Bootstrapping NestJS module...')
    app = await NestFactory.createApplicationContext(ScriptModule, {
      logger: ['error', 'warn', 'log'],
    })

    console.log('Module initialized successfully')
    console.log('')

    // Get the service from the DI container
    const analyzeService = app.get(AnalyzeFailedIntentsService)

    // Run the analysis
    console.log('Starting analysis...')
    console.log('')
    await analyzeService.analyze(resolvedInputFile, resolvedOutputFile)

    console.log('')
    console.log('='.repeat(80))
    console.log('Analysis completed successfully!')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('')
    console.error('='.repeat(80))
    console.error('Analysis failed!')
    console.error('='.repeat(80))
    console.error(`Error: ${error.message}`)
    if (error.stack) {
      console.error('')
      console.error('Stack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    // Close the application and MongoDB connection
    if (app) {
      console.log('')
      console.log('Closing connections...')
      await app.close()
      console.log('Done.')
    }
  }
}

// Run the script
bootstrap()
