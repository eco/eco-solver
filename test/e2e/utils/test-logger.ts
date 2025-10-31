/**
 * Test Logger Utility
 *
 * Provides structured logging for E2E tests with clear visual separation.
 */

/**
 * Log a test section header
 */
export function logSection(title: string): void {
  const border = '='.repeat(60);
  console.log(`\n${border}`);
  console.log(`  ${title}`);
  console.log(`${border}\n`);
}

/**
 * Log a test step
 */
export function logStep(step: string, details?: string): void {
  console.log(`\n📌 ${step}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

/**
 * Log a success message
 */
export function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

/**
 * Log an info message
 */
export function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

/**
 * Log a warning message
 */
export function logWarning(message: string): void {
  console.log(`⚠️  ${message}`);
}

/**
 * Log transaction details
 */
export function logTransaction(txHash: string, chainId: number, description?: string): void {
  console.log(`\n💳 Transaction: ${txHash}`);
  console.log(`   Chain ID: ${chainId}`);
  if (description) {
    console.log(`   ${description}`);
  }
}

/**
 * Log intent details
 */
export function logIntent(intentHash: string, details?: Record<string, any>): void {
  console.log(`\n🎯 Intent: ${intentHash}`);
  if (details) {
    Object.entries(details).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }
}

/**
 * Log timing information
 */
export function logTiming(operation: string, milliseconds: number): void {
  const seconds = (milliseconds / 1000).toFixed(2);
  console.log(`⏱️  ${operation}: ${seconds}s (${milliseconds}ms)`);
}

/**
 * Create a timer for measuring operation duration
 */
export class Timer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
  }

  /**
   * Stop the timer and log the duration
   */
  stop(): number {
    const duration = Date.now() - this.startTime;
    logTiming(this.label, duration);
    return duration;
  }

  /**
   * Get elapsed time without stopping
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}
