import { EnhancedJsonLogger } from './enhanced-json-logger'

describe('EnhancedJsonLogger - Enhancement Utilities', () => {
  describe('createReceiptAnalysis', () => {
    it('should create receipt analysis from successful transaction receipt', () => {
      const receipt = {
        transactionHash: '0x1234567890abcdef1234567890abcdef12345678',
        blockNumber: 12345678,
        blockHash: '0xabcdef1234567890abcdef1234567890abcdef12',
        gasUsed: '21000',
        gasPrice: '20000000000',
        effectiveGasPrice: '18000000000',
        cumulativeGasUsed: '42000',
        status: 1,
        logs: [
          {
            eventName: 'Transfer',
            address: '0xa0b86a33e6c4b7b7b7b7b7b7b7b7b7b7b7b7b7b7',
            topics: ['0x123', '0x456'],
          },
          {
            eventName: 'Swap',
            address: '0xc0d86a33e6c4b7b7b7b7b7b7b7b7b7b7b7b7b7b7',
            topics: ['0x789', '0xabc', '0xdef'],
          },
        ],
      }

      const startTime = Date.now() - 5000 // 5 seconds ago
      const analysis = EnhancedJsonLogger.createReceiptAnalysis(receipt, startTime)

      expect(analysis).toMatchObject({
        transaction_hash: '0x1234567890abcdef1234567890abcdef12345678',
        block_number: 12345678,
        block_hash: '0xabcdef1234567890abcdef1234567890abcdef12',
        gas_used: 21000,
        gas_price: '20000000000',
        effective_gas_price: '18000000000',
        cumulative_gas_used: 42000,
        status: 'success',
        event_count: 2,
        confirmation_time_ms: expect.any(Number),
        receipt_size_bytes: expect.any(Number),
      })

      expect(analysis.events).toHaveLength(2)
      expect(analysis.events![0]).toMatchObject({
        event_name: 'Transfer',
        contract_address: '0xa0b86a33e6c4b7b7b7b7b7b7b7b7b7b7b7b7b7b7',
        topics_count: 2,
      })
      expect(analysis.confirmation_time_ms).toBeGreaterThanOrEqual(4000)
    })

    it('should handle failed transaction receipt', () => {
      const receipt = {
        transactionHash: '0xfailed1234567890abcdef1234567890abcdef12',
        status: 0,
        gasUsed: '50000',
        logs: [],
      }

      const analysis = EnhancedJsonLogger.createReceiptAnalysis(receipt)

      expect(analysis.status).toBe('failed')
      expect(analysis.event_count).toBe(0)
      expect(analysis.events).toEqual([])
      expect(analysis.confirmation_time_ms).toBeUndefined()
    })

    it('should handle receipt with hex status values', () => {
      const receipt = {
        transactionHash: '0xhex1234567890abcdef1234567890abcdef123456',
        status: '0x1',
        gasUsed: '30000',
      }

      const analysis = EnhancedJsonLogger.createReceiptAnalysis(receipt)
      expect(analysis.status).toBe('success')

      receipt.status = '0x0'
      const failedAnalysis = EnhancedJsonLogger.createReceiptAnalysis(receipt)
      expect(failedAnalysis.status).toBe('failed')
    })
  })

  describe('createRejectionDetails', () => {
    it('should categorize liquidity errors correctly', () => {
      const error = {
        message: 'Insufficient liquidity for swap',
        code: 'LIQUIDITY_ERROR',
        liquidityDepth: '1000000000000000000',
      }

      const context = {
        provider: 'uniswap',
        slippageCalculated: 0.05,
        maxSlippage: 0.03,
        quotesAttempted: 3,
        fallbackAttempted: true,
      }

      const details = EnhancedJsonLogger.createRejectionDetails(error, context)

      expect(details).toMatchObject({
        error_code: 'LIQUIDITY_ERROR',
        error_category: 'liquidity',
        provider_response: 'Insufficient liquidity for swap',
        slippage_calculated: 0.05,
        max_slippage_allowed: 0.03,
        quotes_attempted: 3,
        fallback_attempted: true,
        retry_count: 0,
        upstream_service: 'uniswap',
      })

      expect(details.token_analysis).toMatchObject({
        liquidity_depth: '1000000000000000000',
        volatility_warning: false,
      })
    })

    it('should categorize slippage errors correctly', () => {
      const error = {
        message: 'Slippage tolerance exceeded',
        name: 'SlippageError',
        priceImpact: 0.08,
      }

      const details = EnhancedJsonLogger.createRejectionDetails(error)

      expect(details.error_category).toBe('slippage')
      expect(details.token_analysis?.price_impact).toBe(0.08)
    })

    it('should categorize balance errors correctly', () => {
      const error = {
        message: 'Insufficient balance for transaction',
        code: 'INSUFFICIENT_FUNDS',
      }

      const details = EnhancedJsonLogger.createRejectionDetails(error)

      expect(details.error_category).toBe('balance')
      expect(details.error_code).toBe('INSUFFICIENT_FUNDS')
    })

    it('should categorize network errors correctly', () => {
      const error = {
        message: 'Network timeout occurred',
        timeout: true,
        gasPrice: '80000000000',
      }

      const details = EnhancedJsonLogger.createRejectionDetails(error)

      expect(details.error_category).toBe('network')
      expect(details.network_conditions).toMatchObject({
        gas_price: '80000000000',
        network_congestion: 'high',
      })
    })

    it('should categorize provider errors correctly', () => {
      const error = {
        message: 'Quote provider returned invalid response',
        providerCode: 'INVALID_RESPONSE',
      }

      const details = EnhancedJsonLogger.createRejectionDetails(error)

      expect(details.error_category).toBe('provider')
      expect(details.provider_error_code).toBe('INVALID_RESPONSE')
    })

    it('should default to validation category for unknown errors', () => {
      const error = {
        message: 'Some random validation error',
      }

      const details = EnhancedJsonLogger.createRejectionDetails(error)

      expect(details.error_category).toBe('validation')
      expect(details.quotes_attempted).toBe(1)
      expect(details.fallback_attempted).toBe(false)
      expect(details.retry_count).toBe(0)
    })
  })

  describe('createLifecycleTimestamps', () => {
    it('should create comprehensive lifecycle timestamps', () => {
      const baseTimestamps = {
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:30:00Z'),
      }

      const operationTimestamps = {
        startedAt: new Date('2024-01-01T10:05:00Z'),
        completedAt: new Date('2024-01-01T10:25:00Z'),
        processingStarted: new Date('2024-01-01T10:10:00Z'),
        processingCompleted: new Date('2024-01-01T10:20:00Z'),
      }

      const timestamps = EnhancedJsonLogger.createLifecycleTimestamps(
        baseTimestamps,
        operationTimestamps,
      )

      expect(timestamps).toMatchObject({
        created_at: '2024-01-01T10:00:00.000Z',
        updated_at: '2024-01-01T10:30:00.000Z',
        started_at: '2024-01-01T10:05:00.000Z',
        completed_at: '2024-01-01T10:25:00.000Z',
        processing_started: '2024-01-01T10:10:00.000Z',
        processing_completed: '2024-01-01T10:20:00.000Z',
        validation_completed: '2024-01-01T10:25:00.000Z',
        execution_started: '2024-01-01T10:05:00.000Z',
        execution_completed: '2024-01-01T10:25:00.000Z',
        first_seen: '2024-01-01T10:00:00.000Z',
      })

      // These should be current timestamp
      expect(timestamps.last_status_change).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
      expect(timestamps.last_seen).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
    })

    it('should handle missing timestamps gracefully', () => {
      const timestamps = EnhancedJsonLogger.createLifecycleTimestamps()

      expect(timestamps.created_at).toBeUndefined()
      expect(timestamps.updated_at).toBeUndefined()
      expect(timestamps.started_at).toBeUndefined()
      expect(timestamps.completed_at).toBeUndefined()

      // These should still be set
      expect(timestamps.last_status_change).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
      expect(timestamps.last_seen).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
    })

    it('should handle failed operation timestamps', () => {
      const operationTimestamps = {
        startedAt: new Date('2024-01-01T10:05:00Z'),
        failedAt: new Date('2024-01-01T10:15:00Z'),
      }

      const timestamps = EnhancedJsonLogger.createLifecycleTimestamps({}, operationTimestamps)

      expect(timestamps.started_at).toBe('2024-01-01T10:05:00.000Z')
      expect(timestamps.failed_at).toBe('2024-01-01T10:15:00.000Z')
      expect(timestamps.completed_at).toBeUndefined()
    })
  })

  describe('analyzeNetworkCongestion', () => {
    it('should detect high congestion from timeout and queue depth', () => {
      const error = { timeout: true, queueDepth: 150 }
      // Access private method via bracket notation for testing
      const congestion = (EnhancedJsonLogger as any).analyzeNetworkCongestion(error)
      expect(congestion).toBe('high')
    })

    it('should detect medium congestion from gas price and moderate queue', () => {
      const error = { gasPrice: '60000000000', queueDepth: 75 }
      const congestion = (EnhancedJsonLogger as any).analyzeNetworkCongestion(error)
      expect(congestion).toBe('medium')
    })

    it('should detect low congestion for normal conditions', () => {
      const error = { gasPrice: '20000000000', queueDepth: 10 }
      const congestion = (EnhancedJsonLogger as any).analyzeNetworkCongestion(error)
      expect(congestion).toBe('low')
    })

    it('should default to low congestion for empty error', () => {
      const congestion = (EnhancedJsonLogger as any).analyzeNetworkCongestion({})
      expect(congestion).toBe('low')
    })
  })
})
