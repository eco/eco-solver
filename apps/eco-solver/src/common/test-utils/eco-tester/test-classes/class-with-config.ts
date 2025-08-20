import { Injectable } from '@nestjs/common'
import { EcoConfigService } from '@libs/eco-solver-config'

@Injectable()
export class ClassWithConfig {
  private classConfig: any
  constructor(private readonly config: EcoConfigService) {
    this.classConfig = EcoConfigService.getStaticConfig()
  }

  public gimmeConfig(): any {
    return this.classConfig
  }
}
