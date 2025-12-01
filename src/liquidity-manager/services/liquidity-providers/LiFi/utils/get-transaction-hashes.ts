import { Logger } from '@nestjs/common'
import { RouteExtended } from '@lifi/sdk'
import type { Hex } from 'viem'
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

/**
 * Extracts the most recent transaction hash from a LiFi RouteExtended-like result.
 * It scans steps and their execution processes in reverse order, returning the
 * last non-empty `txHash` it encounters.
 *
 * This helper is intentionally logging-agnostic; callers are responsible for
 * emitting any warnings or debug information when the hash cannot be found.
 */
export function extractLiFiTxHash(result: RouteExtended | any): Hex | undefined {
  if (!Array.isArray(result?.steps) || result.steps.length === 0) {
    return undefined
  }

  for (let i = result.steps.length - 1; i >= 0; i--) {
    const step = result.steps[i]
    const processes = step?.execution?.process
    if (!Array.isArray(processes) || processes.length === 0) {
      continue
    }

    for (let j = processes.length - 1; j >= 0; j--) {
      const txHash = processes[j]?.txHash
      if (txHash) {
        return txHash as Hex
      }
    }
  }

  return undefined
}
