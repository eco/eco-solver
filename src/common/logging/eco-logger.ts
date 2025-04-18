import { Logger } from '@nestjs/common'

export class EcoLogger extends Logger {
  static logErrorAlways = false

  constructor(context: string, options?: { timestamp?: boolean }) {
    super(context, options)
  }

  static setLoggingForUnitTests() {
    this.logErrorAlways = true
  }

  info(message: any, ...optionalParams: [...any, string?]): void {
    if (EcoLogger.logErrorAlways) {
      super.error(message, ...optionalParams)
    } else {
      super.log(message, ...optionalParams)
    }
  }

  warn(message: any, ...optionalParams: [...any, string?]): void {
    if (EcoLogger.logErrorAlways) {
      super.error(message, ...optionalParams)
    } else {
      super.warn(message, ...optionalParams)
    }
  }

  error(message: any, ...optionalParams: [...any, string?]): void {
    super.error(message, ...optionalParams)
  }

  debug(message: any, ...optionalParams: [...any, string?]): void {
    if (EcoLogger.logErrorAlways) {
      super.error(message, ...optionalParams)
    } else {
      super.debug(message, ...optionalParams)
    }
  }
}
