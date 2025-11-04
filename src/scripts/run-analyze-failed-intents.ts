#!/usr/bin/env node

import { NestFactory } from '@nestjs/core'
import 'dotenv/config'
import { ScriptModule } from './script.module'
import { AnalyzeFailedIntentsService } from './analyze-failed-intents.service'
import * as path from 'path'

/**
 * Script to analyze failed intents
 *
 * Two modes of operation:
 *
 * MODE 1: GraphQL Indexer Mode (recommended)
 * Fetches refunded intents from the GraphQL indexer since a given date.
 * The script:
 * 1. Queries GraphQL indexer for refunded intents (handles pagination automatically)
 * 2. Queries MongoDB for intents by intent hashes
 * 3. Generates analysis CSV with intent details and error messages
 *
 * MODE 2: File-based Mode (legacy)
 * Processes transactions from a CSV file.
 * Input CSV format (no headers): chainID,transactionHash
 * Example:
 *   1,0x123abc...
 *   10,0x456def...
 *
 * Required Environment Variables:
 *   MONGODB_URI     - MongoDB connection string (e.g., mongodb+srv://user:pass@host/db)
 *   INDEXER_URL     - GraphQL indexer URL (optional, defaults to https://indexer.eco.com)
 *   ERPC_BASE_URL   - eRPC base URL (only needed for file-based mode)
 *
 * Usage (GraphQL Mode):
 *   MONGODB_URI=<mongo-uri> ts-node src/scripts/run-analyze-failed-intents.ts --start-date <date> [--output <output-file>]
 *
 * Usage (File Mode):
 *   MONGODB_URI=<mongo-uri> ts-node src/scripts/run-analyze-failed-intents.ts --input <input-file> [--output <output-file>]
 *
 * Arguments:
 *   --start-date, -s  Start date for GraphQL mode (format: YYYY-MM-DD, defaults to 2025-10-01)
 *   --input, -i       Path to input CSV file for file-based mode
 *   --output, -o      Path to output CSV file (optional, defaults to current directory with timestamp)
 *
 * Examples:
 *   # GraphQL mode with default date (Oct 1st 2025)
 *   MONGODB_URI=mongodb://localhost:27017/ecosolver ts-node src/scripts/run-analyze-failed-intents.ts
 *
 *   # GraphQL mode with custom start date
 *   MONGODB_URI=mongodb://localhost:27017/ecosolver ts-node src/scripts/run-analyze-failed-intents.ts -s 2025-11-01
 *
 *   # File-based mode
 *   MONGODB_URI=mongodb://localhost:27017/ecosolver ts-node src/scripts/run-analyze-failed-intents.ts -i transactions.csv
 */

async function bootstrap() {
  // Parse command line arguments
  const args = process.argv.slice(2)
  let inputFile: string | undefined
  let outputFile: string | undefined
  let startDateStr: string | undefined

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--input' || args[i] === '-i') && i + 1 < args.length) {
      inputFile = args[i + 1]
      i++
    } else if ((args[i] === '--output' || args[i] === '-o') && i + 1 < args.length) {
      outputFile = args[i + 1]
      i++
    } else if ((args[i] === '--start-date' || args[i] === '-s') && i + 1 < args.length) {
      startDateStr = args[i + 1]
      i++
    }
  }

  // Determine mode and validate arguments
  const useGraphQLMode = !inputFile
  let startTimestamp: number | undefined

  if (useGraphQLMode) {
    // GraphQL mode: use start date (default to Oct 1st 2025)
    const defaultDate = '2025-10-01'
    const dateToUse = startDateStr || defaultDate

    // Parse date (format: YYYY-MM-DD)
    const dateMatch = dateToUse.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!dateMatch) {
      console.error(`Error: Invalid date format: ${dateToUse}`)
      console.error('Expected format: YYYY-MM-DD')
      process.exit(1)
    }

    // Create date at midnight UTC and convert to Unix timestamp in seconds
    const date = new Date(`${dateToUse}T00:00:00.000Z`)
    startTimestamp = Math.floor(date.getTime() / 1000)
  } else if (inputFile && startDateStr) {
    console.error('Error: Cannot use both --input and --start-date together')
    console.log('Use --input for file-based mode OR --start-date for GraphQL mode, not both')
    process.exit(1)
  }

  // Resolve file paths
  const resolvedInputFile = inputFile ? path.resolve(process.cwd(), inputFile) : undefined
  const resolvedOutputFile = outputFile ? path.resolve(process.cwd(), outputFile) : undefined

  // Generate cache file path for GraphQL mode
  let cacheFilePath: string | undefined
  if (useGraphQLMode && startTimestamp) {
    const outputDir = resolvedOutputFile ? path.dirname(resolvedOutputFile) : process.cwd()
    const date = new Date(startTimestamp * 1000)
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
    const cacheFileName = `intent-hashes-cache-${dateStr}.csv`
    cacheFilePath = path.join(outputDir, cacheFileName)
  }

  console.log('='.repeat(80))
  console.log('Analyze Failed Intents Script')
  console.log('='.repeat(80))
  if (useGraphQLMode) {
    console.log(`Mode:        GraphQL Indexer`)
    console.log(`Start date:  ${startDateStr || '2025-10-01'} (timestamp: ${startTimestamp})`)
    console.log(`Cache file:  ${cacheFilePath}`)
  } else {
    console.log(`Mode:        File-based`)
    console.log(`Input file:  ${resolvedInputFile}`)
  }
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
    await analyzeService.analyze(resolvedInputFile, resolvedOutputFile, startTimestamp)

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
