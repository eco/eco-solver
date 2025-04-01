import { Logger } from '@nestjs/common'
import { RouteExtended } from '@eco-foundation/lifi-sdk'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

export function logLiFiProcess(logger: Logger, route: RouteExtended) {
  route.steps.forEach((step, index) => {
    step.execution?.process.forEach((process) => {
      logger.log(
        EcoLogMessage.fromDefault({
          message: `LiFi: Step ${index + 1}, Process ${process.type}:`,
          properties: process,
        }),
      )
    })
  })
}
