import {
  extractIntentModelSummary,
  extractSolverSummary,
  extractReceiptSummary,
  extractErrorSummary,
  estimateObjectSize,
} from '../model-extractors'

describe('Model Extractors', () => {
  describe('extractIntentModelSummary', () => {
    it('should return null for null input', () => {
      expect(extractIntentModelSummary(null)).toBeNull()
    })

    it('should extract only essential fields from intent model', () => {
      const largeModel = {
        intent: {
          hash: '0x123',
          route: {
            source: 1,
            destination: 2,
            creator: '0xabc',
            prover: '0xdef',
            tokens: [
              { address: '0x1', amount: '1000' },
              { address: '0x2', amount: '2000' },
            ],
            calls: [{ target: '0x3', data: '0x...' }],
          },
        },
        status: 'PENDING',
        receipt: {
          transactionHash: '0x456',
          status: 'success',
          gasUsed: BigInt(21000),
          logs: new Array(100).fill({ data: '0x...', topics: [] }),
        },
        event: {
          transactionHash: '0x789',
          logIndex: 5,
          data: '0x...',
        },
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      }

      const summary = extractIntentModelSummary(largeModel)

      // Should have essential fields
      expect(summary.intent_hash).toBe('0x123')
      expect(summary.status).toBe('PENDING')
      expect(summary.source_chain_id).toBe(1)
      expect(summary.destination_chain_id).toBe(2)

      // Should have counts instead of arrays
      expect(summary.token_count).toBe(2)
      expect(summary.call_count).toBe(1)

      // Should have receipt summary, not full receipt
      expect(summary.has_receipt).toBe(true)
      expect(summary.receipt_log_count).toBe(100)
      expect(summary.receipt_gas_used).toBe('21000')

      // Should NOT have large objects
      expect(summary.intent).toBeUndefined()
      expect(summary.receipt).toBeUndefined()
      expect(summary.event).toBeUndefined()

      // Verify size reduction (skip original size check due to BigInt serialization)
      const summarySize = JSON.stringify(summary).length
      expect(summarySize).toBeLessThan(2000) // Summary should be under 2KB
    })
  })

  describe('extractSolverSummary', () => {
    it('should return null for null input', () => {
      expect(extractSolverSummary(null)).toBeNull()
    })

    it('should extract only essential fields from solver', () => {
      const largeSolver = {
        chainID: 1,
        inboxAddress: '0xabc',
        targets: {
          '0x1': { abi: [], address: '0x1' },
          '0x2': { abi: [], address: '0x2' },
          '0x3': { abi: [], address: '0x3' },
        },
        supportedTokens: ['0xa', '0xb', '0xc', '0xd'],
        supportsERC20: true,
        supportsNative: false,
      }

      const summary = extractSolverSummary(largeSolver)

      // Should have essential fields
      expect(summary.chain_id).toBe(1)
      expect(summary.inbox_address).toBe('0xabc')

      // Should have counts
      expect(summary.targets_count).toBe(3)
      expect(summary.supported_tokens_count).toBe(4)

      // Should have capability flags
      expect(summary.supports_erc20).toBe(true)
      expect(summary.supports_native).toBe(false)

      // Should NOT have large objects
      expect(summary.targets).toBeUndefined()
      expect(summary.supportedTokens).toBeUndefined()
    })
  })

  describe('extractReceiptSummary', () => {
    it('should return null for null input', () => {
      expect(extractReceiptSummary(null)).toBeNull()
    })

    it('should extract only essential fields from receipt', () => {
      const largeReceipt = {
        transactionHash: '0x123',
        blockHash: '0x456',
        blockNumber: BigInt(12345),
        status: 'success',
        type: '0x2',
        gasUsed: BigInt(21000),
        cumulativeGasUsed: BigInt(100000),
        effectiveGasPrice: BigInt(1000000000),
        logs: new Array(150).fill({
          address: '0x1',
          topics: ['0x...', '0x...', '0x...'],
          data: '0x' + 'a'.repeat(1000),
        }),
        from: '0xfrom',
        to: '0xto',
      }

      const summary = extractReceiptSummary(largeReceipt)

      // Should have essential fields
      expect(summary.transaction_hash).toBe('0x123')
      expect(summary.block_number).toBe('12345')
      expect(summary.status).toBe('success')

      // Should have gas metrics
      expect(summary.gas_used).toBe('21000')
      expect(summary.effective_gas_price).toBe('1000000000')

      // Should have log count, not logs
      expect(summary.log_count).toBe(150)
      expect(summary.logs).toBeUndefined()

      // Verify size reduction (skip original size check due to BigInt serialization)
      const summarySize = JSON.stringify(summary).length
      expect(summarySize).toBeLessThan(1000) // Summary should be under 1KB
    })
  })

  describe('extractErrorSummary', () => {
    it('should return null for null input', () => {
      expect(extractErrorSummary(null)).toBeNull()
    })

    it('should handle string errors', () => {
      const summary = extractErrorSummary('Simple error')
      expect(summary.message).toBe('Simple error')
    })

    it('should extract essential fields from error object', () => {
      const largeError = new Error('Test error')
      largeError.name = 'CustomError'
      ;(largeError as any).code = 'TEST_CODE'
      ;(largeError as any).context = {
        model: {
          /* large object */
        },
        solver: {
          /* large object */
        },
        receipt: {
          /* large object */
        },
      }

      const summary = extractErrorSummary(largeError)

      // Should have essential fields
      expect(summary.message).toBe('Test error')
      expect(summary.name).toBe('CustomError')
      expect(summary.code).toBe('TEST_CODE')

      // Should have context summary, not full context
      expect(summary.has_context).toBe(true)
      expect(summary.context_keys).toBe('model,solver,receipt')
      expect(summary.context).toBeUndefined()

      // Stack should be truncated
      expect(summary.stack).toBeDefined()
      expect(summary.stack.length).toBeLessThanOrEqual(503) // 500 + '...'
    })
  })

  describe('estimateObjectSize', () => {
    it('should handle null and undefined', () => {
      expect(estimateObjectSize(null)).toBe(0)
      expect(estimateObjectSize(undefined)).toBe(0)
    })

    it('should handle primitives', () => {
      expect(estimateObjectSize(123)).toBeGreaterThan(0)
      expect(estimateObjectSize('hello')).toBeGreaterThan(0)
      expect(estimateObjectSize(true)).toBeGreaterThan(0)
    })

    it('should count object properties', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const size = estimateObjectSize(obj)
      expect(size).toBeGreaterThan(0)
      expect(size).toBeLessThan(100)
    })

    it('should handle nested objects', () => {
      const obj = {
        a: { b: { c: { d: 1 } } },
      }
      const size = estimateObjectSize(obj)
      expect(size).toBeGreaterThan(0)
    })

    it('should throw for oversized objects', () => {
      const largeObj: any = {}
      for (let i = 0; i < 11000; i++) {
        largeObj[`key${i}`] = i
      }

      expect(() => estimateObjectSize(largeObj, 10000)).toThrow('Object too large')
    })

    it('should handle circular references', () => {
      const obj: any = { a: 1 }
      obj.self = obj

      const size = estimateObjectSize(obj)
      expect(size).toBeGreaterThan(0)
      expect(size).toBeLessThan(100) // Should not infinitely loop
    })

    it('should respect custom maxSize', () => {
      const obj: any = {}
      for (let i = 0; i < 150; i++) {
        obj[`key${i}`] = i
      }

      // Should throw with limit of 100
      expect(() => estimateObjectSize(obj, 100)).toThrow('Object too large')

      // Should succeed with limit of 200
      expect(() => estimateObjectSize(obj, 200)).not.toThrow()
    })
  })
})
