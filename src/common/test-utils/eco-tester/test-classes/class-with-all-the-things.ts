import { AnotherSimpleClass } from './another-simple-class'
import { ClassWithConfig } from './class-with-config'
import { ClassWithDependency } from './class-with-dependency'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { SimpleClass } from './simple-class'
import { TestDBModel } from './test-db-model'
import * as mongoose from 'mongoose'

@Injectable()
export class ClassWithAllTheThings {
  constructor(
    public readonly simpleDependency: SimpleClass,
    public readonly anotherSimpleDependency: AnotherSimpleClass,
    public readonly classWithConfig: ClassWithConfig,
    public readonly classWithDependency: ClassWithDependency,
    @InjectModel('testSchema') public model: mongoose.Model<TestDBModel>,
  ) {}

  public doThing(param1: string): string {
    return (
      param1 +
      this.simpleDependency.doThing(param1) +
      this.anotherSimpleDependency.doThing(param1) +
      this.classWithDependency.doThing(param1)
    )
  }

  public gimmeConfig(): any {
    return this.classWithConfig.gimmeConfig()
  }
}
