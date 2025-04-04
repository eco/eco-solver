import { Injectable } from '@nestjs/common'

@Injectable()
export class AnotherSimpleClass {
  public doThing(param1: string): string {
    return param1 + 'DoAnotherThing'
  }
}
