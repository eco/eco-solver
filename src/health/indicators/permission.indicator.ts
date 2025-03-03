import { Injectable, Logger } from '@nestjs/common'
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Solver } from '../../eco-configs/eco-config.types'
import { Hex } from 'viem'
import { KernelAccountClientService } from '../../transaction/smart-wallets/kernel/kernel-account-client.service'
import { InboxAbi } from '@eco-foundation/routes-ts'

@Injectable()
export class PermissionHealthIndicator extends HealthIndicator {
  private logger = new Logger(PermissionHealthIndicator.name)
  private readonly solverPermissions: Map<string, { account: Hex; whitelisted: boolean }> =
    new Map()

  constructor(
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly configService: EcoConfigService,
  ) {
    super()
  }

  async checkPermissions(): Promise<HealthIndicatorResult> {
    //iterate over all solvers
    await Promise.all(
      Object.entries(this.configService.getSolvers()).map(async (entry) => {
        const [, solver] = entry
        await this.loadPermissions(solver)
      }),
    )
    const isHealthy = Array.from(this.solverPermissions.values()).every(
      (value) => value.whitelisted,
    )
    const permissionsString = {}
    this.solverPermissions.forEach((value, key) => {
      permissionsString[key] = value
    })

    const results = this.getStatus('permissions', isHealthy, { permissions: permissionsString })
    if (isHealthy) {
      return results
    }
    throw new HealthCheckError('Permissions failed', results)
  }

  private async loadPermissions(solver: Solver) {
    const key = this.getSolverKey(solver.network, solver.chainID, solver.inboxAddress)
    const client = await this.kernelAccountClientService.getClient(solver.chainID)
    const address = client.account?.address || '0x0'
    const whitelisted = await client.readContract({
      address: solver.inboxAddress,
      abi: InboxAbi,
      functionName: 'solverWhitelist',
      args: [address],
    })
    this.solverPermissions.set(key, {
      account: address,
      whitelisted,
    })
  }

  private getSolverKey(network: string, chainID: number, address: Hex): string {
    return `${network}-${chainID}-${address}`
  }
}
