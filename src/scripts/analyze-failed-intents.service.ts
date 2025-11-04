import { Injectable, Logger } from '@nestjs/common'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createPublicClient, Hex, http, parseEventLogs, TransactionReceipt } from 'viem'
import { portalAbi } from '@/contracts/v2-abi/Portal'

export interface TransactionData {
  chainId: number
  transactionHash: Hex
}

export interface AnalysisResult {
  intentHash: string
  createdAt: string
  sourceChainId: string
  rewardToken: string
  rewardAmount: string
  destinationChainId: string
  routeToken: string
  routeAmount: string
  errorMessage: string
}

export interface GraphQLRefundItem {
  hash: string
}

export interface GraphQLRefundsResponse {
  data: {
    refunds: {
      totalCount: number
      pageInfo: {
        hasNextPage: boolean
        endCursor: string
      }
      items: GraphQLRefundItem[]
    }
  }
}

@Injectable()
export class AnalyzeFailedIntentsService {
  private logger = new Logger(AnalyzeFailedIntentsService.name)
  private readonly erpcBaseUrl: string
  private readonly indexerUrl: string

  constructor(private readonly intentSourceRepository: IntentSourceRepository) {
    this.erpcBaseUrl = process.env.ERPC_BASE_URL!
    this.indexerUrl = process.env.INDEXER_URL || 'https://indexer.eco.com'
  }

  /**
   * Reads transaction data from CSV file (chainID,transactionHash format, no headers)
   * @param filePath Path to the input CSV file
   * @returns Array of transaction data objects
   */
  async readTransactionData(filePath: string): Promise<TransactionData[]> {
    this.logger.log(`Reading transaction data from: ${filePath}`)
    const content = await fs.readFile(filePath, 'utf-8')

    // Parse CSV (no headers)
    const lines = content.split(/\r?\n/).filter((line) => line.trim())
    const transactions: TransactionData[] = []

    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim())
      if (parts.length >= 2) {
        const chainId = parseInt(parts[0], 10)
        const transactionHash = parts[1] as Hex

        if (!isNaN(chainId) && transactionHash.startsWith('0x')) {
          transactions.push({ chainId, transactionHash })
        } else {
          this.logger.warn(`Invalid line format: ${line}`)
        }
      }
    }

    this.logger.log(`Found ${transactions.length} transactions`)
    return transactions
  }

  /**
   * Fetches refunded intents from the GraphQL indexer with pagination
   * @param startTimestamp Unix timestamp in seconds (e.g., Oct 1st 2025)
   * @returns Array of unique intent hashes
   */
  async fetchRefundedIntentsFromIndexer(startTimestamp: number): Promise<Hex[]> {
    this.logger.log(
      `Fetching refunded intents from indexer since ${new Date(startTimestamp * 1000).toISOString()}`,
    )

    const allIntentHashes: Hex[] = []
    let cursor: string | null = null
    let pageNumber = 1

    const query = `
      query ($now: BigInt!, $cursor: String) {
        refunds(where: {blockTimestamp_gte: $now}, after: $cursor) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          items {
            hash
          }
        }
      }
    `

    try {
      do {
        this.logger.log(`Fetching page ${pageNumber}...`)

        const variables: { now: string; cursor?: string } = {
          now: startTimestamp.toString(),
        }
        if (cursor) {
          variables.cursor = cursor
        }

        const response = await fetch(this.indexerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: GraphQLRefundsResponse = await response.json()

        if (!result.data?.refunds) {
          throw new Error('Invalid response from indexer')
        }

        const { items, pageInfo, totalCount } = result.data.refunds

        this.logger.log(
          `Page ${pageNumber}: Found ${items.length} refunds (Total: ${totalCount}, HasNextPage: ${pageInfo.hasNextPage})`,
        )

        // Extract intent hashes
        const intentHashes = items.map((item) => item.hash as Hex)
        allIntentHashes.push(...intentHashes)

        // Update cursor for next page
        cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null
        pageNumber++
      } while (cursor !== null)

      // Remove duplicates
      const uniqueIntentHashes = [...new Set(allIntentHashes)]

      this.logger.log(
        `Fetched ${allIntentHashes.length} intent hashes (${uniqueIntentHashes.length} unique) from indexer`,
      )

      return uniqueIntentHashes
    } catch (error) {
      this.logger.error(`Failed to fetch refunded intents from indexer: ${error.message}`)
      throw error
    }
  }

  /**
   * Fetches transaction receipt from RPC endpoint
   * @param chainId Chain ID for the transaction
   * @param transactionHash Transaction hash
   * @returns Transaction receipt
   */
  async fetchTransactionReceipt(chainId: number, transactionHash: Hex) {
    const rpcUrl = `${this.erpcBaseUrl}/${chainId}`

    const client = createPublicClient({
      transport: http(rpcUrl),
    })

    this.logger.debug(`Fetching receipt for tx ${transactionHash} on chain ${chainId}`)

    try {
      return await client.getTransactionReceipt({
        hash: transactionHash,
      })
    } catch (error) {
      this.logger.error(
        `Failed to fetch receipt for tx ${transactionHash} on chain ${chainId}: ${error.message}`,
      )
      throw error
    }
  }

  /**
   * Extracts intent hashes from IntentRefunded events in a transaction receipt
   * @param receipt Transaction receipt
   * @returns Array of intent hashes
   */
  extractIntentHashesFromReceipt(receipt: TransactionReceipt): Hex[] {
    try {
      const refundedEvents = parseEventLogs({
        abi: portalAbi,
        eventName: 'IntentRefunded',
        logs: receipt.logs,
      })

      const intentHashes = refundedEvents.map((event) => event.args.intentHash as Hex)

      this.logger.debug(
        `Found ${intentHashes.length} IntentRefunded events in tx ${receipt.transactionHash}`,
      )

      return intentHashes
    } catch (error) {
      this.logger.error(
        `Error parsing IntentRefunded events from tx ${receipt.transactionHash}: ${error.message}`,
      )
      return []
    }
  }

  /**
   * Processes transactions to fetch receipts and extract intent hashes
   * @param transactions Array of transaction data
   * @returns Array of unique intent hashes
   */
  async processTransactions(transactions: TransactionData[]): Promise<Hex[]> {
    this.logger.log(`Processing ${transactions.length} transactions...`)

    const allIntentHashes: Hex[] = []

    for (const tx of transactions) {
      try {
        // Fetch receipt
        const receipt = await this.fetchTransactionReceipt(tx.chainId, tx.transactionHash)

        // Extract intent hashes
        const intentHashes = this.extractIntentHashesFromReceipt(receipt)

        if (intentHashes.length === 0) {
          this.logger.warn(
            `No IntentRefunded events found in tx ${tx.transactionHash} on chain ${tx.chainId}`,
          )
        } else {
          allIntentHashes.push(...intentHashes)
        }
      } catch (error) {
        this.logger.error(
          `Failed to process tx ${tx.transactionHash} on chain ${tx.chainId}: ${error.message}`,
        )
      }
    }

    // Remove duplicates
    const uniqueIntentHashes = [...new Set(allIntentHashes)]

    this.logger.log(
      `Extracted ${allIntentHashes.length} intent hashes (${uniqueIntentHashes.length} unique)`,
    )

    return uniqueIntentHashes
  }

  /**
   * Queries MongoDB for intents by intent hashes
   * @param intentHashes Array of intent hashes
   * @returns Array of IntentSourceModel documents
   */
  async getIntentsByIntentHashes(intentHashes: Hex[]): Promise<IntentSourceModel[]> {
    this.logger.log(`Querying intents for ${intentHashes.length} intent hashes`)

    const intents = await this.intentSourceRepository.queryIntents(
      { 'intent.hash': { $in: intentHashes } },
      {
        'event.transactionHash': 1,
        'event.sourceChainID': 1,
        'intent.hash': 1,
        'intent.route.source': 1,
        'intent.route.destination': 1,
        'intent.route.tokens': 1,
        'intent.reward.tokens': 1,
        receipt: 1,
        status: 1,
        createdAt: 1,
      },
    )

    // Sort by createdAt DESC
    intents.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    })

    this.logger.log(`Found ${intents.length} intents`)

    // Log warning for intent hashes not found
    const foundHashes = new Set(intents.map((i) => i.intent.hash))
    const notFoundHashes = intentHashes.filter((hash) => !foundHashes.has(hash))
    if (notFoundHashes.length > 0) {
      this.logger.warn(
        `${notFoundHashes.length} intent hash(es) not found in database: ${notFoundHashes.slice(0, 5).join(', ')}${notFoundHashes.length > 5 ? '...' : ''}`,
      )
    }

    return intents
  }

  /**
   * Extracts error message from receipt field
   * @param receipt The receipt field which can be a transaction receipt or error object
   * @returns Human-readable error message
   */
  extractErrorMessage(receipt: any): string {
    if (!receipt) {
      return 'No receipt available'
    }

    // Handle different receipt structures
    try {
      // Case 1: TransactionReceipt with status
      if (receipt.status) {
        if (receipt.status === 'reverted') {
          // Try to extract revert reason from logs or data
          if (receipt.logs && receipt.logs.length > 0) {
            return `Transaction reverted (${receipt.logs.length} logs)`
          }
          return 'Transaction reverted'
        }
        return `Status: ${receipt.status}`
      }

      // Case 2: Error object with previous/current structure
      if (receipt.previous || receipt.current) {
        const currentError = receipt.current
        if (currentError) {
          return this.extractErrorFromException(currentError)
        }
        if (receipt.previous && receipt.previous.status === 'reverted') {
          return 'Transaction reverted (previous attempt)'
        }
      }

      // Case 3: Direct error object
      if (receipt.message || receipt.shortMessage) {
        return receipt.message || receipt.shortMessage
      }

      // Case 4: Stringified error
      if (typeof receipt === 'string') {
        return receipt
      }

      // Default: stringify the receipt
      return JSON.stringify(receipt, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    } catch (error) {
      this.logger.error(`Error extracting error message: ${error.message}`)
      return 'Error parsing receipt'
    }
  }

  /**
   * Analyzes an intent and extracts relevant data
   * @param intent The IntentSourceModel document
   * @returns Analysis result
   */
  analyzeIntent(intent: IntentSourceModel): AnalysisResult {
    // Get source chain ID (prefer event.sourceChainID, fallback to intent.route.source)
    const sourceChainId = intent.event?.sourceChainID
      ? intent.event.sourceChainID.toString()
      : intent.intent?.route?.source
        ? intent.intent.route.source.toString()
        : 'Unknown'

    // Get first reward token and amount
    const firstRewardToken = intent.intent?.reward?.tokens?.[0]
    const rewardToken = firstRewardToken?.token || '0x0'
    const rewardAmount = firstRewardToken?.amount?.toString() || '0'

    // Get first route token and amount
    const firstRouteToken = intent.intent?.route?.tokens?.[0]
    const routeToken = firstRouteToken?.token || '0x0'
    const routeAmount = firstRouteToken?.amount?.toString() || '0'

    // Get destination chain ID
    const destinationChainId = intent.intent?.route?.destination
      ? intent.intent.route.destination.toString()
      : 'Unknown'

    // Extract error message
    const errorMessage = this.extractErrorMessage(intent.receipt)

    // Format createdAt
    const createdAt = intent.createdAt ? new Date(intent.createdAt).toISOString() : 'Unknown'

    return {
      intentHash: (intent.intent?.hash as string) || 'Unknown',
      createdAt,
      sourceChainId,
      rewardToken,
      rewardAmount,
      destinationChainId,
      routeToken,
      routeAmount,
      errorMessage,
    }
  }

  /**
   * Converts analysis results to CSV format
   * @param results Array of analysis results
   * @returns CSV string
   */
  convertToCSV(results: AnalysisResult[]): string {
    const headers = [
      'intent_hash',
      'created_at',
      'source_chain_id',
      'reward_token',
      'reward_amount',
      'destination_chain_id',
      'route_token',
      'route_amount',
      'error_message',
    ]

    const csvRows = [headers.join(',')]

    for (const result of results) {
      const row = [
        result.intentHash,
        result.createdAt,
        result.sourceChainId,
        result.rewardToken,
        result.rewardAmount,
        result.destinationChainId,
        result.routeToken,
        result.routeAmount,
        // Escape error message for CSV (quotes and commas)
        `"${result.errorMessage.replace(/"/g, '""')}"`,
      ]
      csvRows.push(row.join(','))
    }

    return csvRows.join('\n')
  }

  /**
   * Writes CSV data to a file
   * @param csvData CSV string
   * @param outputPath Path to the output file
   */
  async writeCSV(csvData: string, outputPath: string): Promise<void> {
    this.logger.log(`Writing CSV to: ${outputPath}`)
    await fs.writeFile(outputPath, csvData, 'utf-8')
    this.logger.log(`CSV written successfully`)
  }

  /**
   * Main analysis function that orchestrates the entire process
   * @param inputFile Path to input CSV file with chainID,transactionHash (optional if using startTimestamp)
   * @param outputFile Path to output CSV file
   * @param startTimestamp Unix timestamp in seconds for GraphQL mode (optional if using inputFile)
   */
  async analyze(inputFile?: string, outputFile?: string, startTimestamp?: number): Promise<void> {
    try {
      let intentHashes: Hex[]

      if (inputFile) {
        // Mode 1: File-based analysis (original flow)
        this.logger.log('Using file-based analysis mode')

        // Read transaction data from input file
        const transactions = await this.readTransactionData(inputFile)

        if (transactions.length === 0) {
          this.logger.warn('No transactions found in input file')
          return
        }

        // Process transactions to extract intent hashes
        intentHashes = await this.processTransactions(transactions)
      } else if (startTimestamp) {
        // Mode 2: GraphQL indexer mode
        this.logger.log('Using GraphQL indexer mode')

        // Fetch refunded intents from indexer
        intentHashes = await this.fetchRefundedIntentsFromIndexer(startTimestamp)
      } else {
        throw new Error('Either inputFile or startTimestamp must be provided')
      }

      if (intentHashes.length === 0) {
        this.logger.warn('No intent hashes found')
        return
      }

      // Query MongoDB for intents
      const intents = await this.getIntentsByIntentHashes(intentHashes)

      if (intents.length === 0) {
        this.logger.warn('No intents found in database for the extracted intent hashes')
        return
      }

      // Analyze each intent
      const results = intents.map((intent) => this.analyzeIntent(intent))

      // Convert to CSV
      const csvData = this.convertToCSV(results)

      // Generate output file name if not provided
      const output =
        outputFile ||
        path.join(
          process.cwd(),
          `failed-intents-analysis-${new Date().toISOString().replace(/:/g, '-')}.csv`,
        )

      // Write to file
      await this.writeCSV(csvData, output)

      this.logger.log(`Analysis complete! Processed ${results.length} intents`)
      this.logger.log(`Output file: ${output}`)
    } catch (error) {
      this.logger.error(`Analysis failed: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * Extracts error message from exception object
   * @param error The error object
   * @returns Human-readable error message
   */
  private extractErrorFromException(error: any): string {
    if (!error) return 'Unknown error'

    // Try to get the most meaningful error message
    if (error.shortMessage) return error.shortMessage
    if (error.message) return error.message
    if (error.details) return error.details
    if (error.reason) return error.reason

    // If it's a string, return it
    if (typeof error === 'string') return error

    // Otherwise stringify it
    try {
      return JSON.stringify(error, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    } catch {
      return String(error)
    }
  }
}
