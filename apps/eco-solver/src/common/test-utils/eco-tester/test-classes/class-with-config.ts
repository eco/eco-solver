import { Injectable } from '@nestjs/common'
import { EcoConfigService } from '../../../../eco-configs/eco-config.service'

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
