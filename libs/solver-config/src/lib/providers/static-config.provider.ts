import { Injectable } from '@nestjs/common'
import { BaseConfigSource } from '../interfaces/config-source.interface'
import { getStaticSolverConfig } from '../solver-config'

@Injectable()
export class StaticConfigProvider extends BaseConfigSource {
  priority = 100 // Lowest priority - base config
  name = 'StaticConfig'

  async getConfig(): Promise<Record<string, unknown>> {
    try {
      return getStaticSolverConfig()
    } catch (error) {
      return this.handleError(error, 'static configuration files')
    }
  }
}
