import { EcoLogger } from '../eco-logger'
import { LogLevel, DatadogLogStructure } from '../types'

/**
 * Base class for specialized loggers with enhanced Datadog structure support
 */
export abstract class BaseStructuredLogger extends EcoLogger {
  constructor(context: string, options?: { timestamp?: boolean }) {
    super(context, options)
  }

  /**
   * Log a structured message using Datadog format
   */
  protected logStructured(structure: DatadogLogStructure, level: LogLevel = 'info'): void {
    switch (level) {
      case 'debug':
        super.debug(structure)
        break
      case 'info':
        super.log(structure)
        break
      case 'warn':
        super.warn(structure)
        break
      case 'error':
        super.error(structure)
        break
    }
  }
}
