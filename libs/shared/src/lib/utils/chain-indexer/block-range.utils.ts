export class BlockRangeUtils {
  static formatBlockRange(from: bigint, to: bigint): string {
    return `${from.toString()}-${to.toString()}`
  }

  static parseBlockRange(range: string): { from: bigint; to: bigint } {
    const [fromStr, toStr] = range.split('-')
    return {
      from: BigInt(fromStr),
      to: BigInt(toStr)
    }
  }

  static calculateOptimalBatchSize(totalRange: bigint, maxBatchSize = 1000n): bigint {
    if (totalRange <= maxBatchSize) {
      return totalRange
    }
    
    return maxBatchSize
  }

  static splitRangeIntoBatches(from: bigint, to: bigint, batchSize = 1000n): Array<{ from: bigint; to: bigint }> {
    const batches: Array<{ from: bigint; to: bigint }> = []
    let currentFrom = from
    
    while (currentFrom <= to) {
      const currentTo = currentFrom + batchSize - 1n <= to ? currentFrom + batchSize - 1n : to
      batches.push({ from: currentFrom, to: currentTo })
      currentFrom = currentTo + 1n
    }
    
    return batches
  }
}