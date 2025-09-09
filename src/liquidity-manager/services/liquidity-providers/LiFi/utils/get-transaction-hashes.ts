import { Logger } from '@nestjs/common'
import { RouteExtended } from '@lifi/sdk'

export function logLiFiProcess(logger: Logger, route: RouteExtended) {
  route.steps.forEach((step, index) => {
    step.execution?.process.forEach((process) => {
      logger.log(`LiFi: Step ${index + 1}, Process ${process.type}:`, {
        service: 'lifi-transaction-processor',
        operation: 'log_process_step',
        stepIndex: index + 1,
        processType: process.type,
        ...process,
      })
    })
  })
}
