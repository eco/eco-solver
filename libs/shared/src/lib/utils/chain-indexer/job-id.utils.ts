export class ChainIndexerJobUtils {
  static getIntentJobId(prefix: string, hash: string, logIndex: number): string {
    return `${prefix}:${hash}:${logIndex}`
  }

  static extractHashFromJobId(jobId: string): string {
    const parts = jobId.split(':')
    return parts[1] || ''
  }

  static extractLogIndexFromJobId(jobId: string): number {
    const parts = jobId.split(':')
    return parseInt(parts[2]) || 0
  }
}