import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { Command, CommandRunner } from 'nest-commander'

@Command({
  name: 'configs',
  arguments: '[task]',
  description: 'A parameter parse',
})
export class EcoConfigCommand extends CommandRunner {
  constructor(private readonly configService: EcoConfigService) {
    super()
  }

  async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
    console.log('CLI Params', passedParams)
    console.log('CLI Options', options)
    console.log('configService: ', this.configService.getSupportedChains())
    return Promise.resolve(undefined)
  }
}
