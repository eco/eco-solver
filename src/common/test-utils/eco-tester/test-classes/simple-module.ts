import { AnotherSimpleClass } from './another-simple-class'
import { Module } from '@nestjs/common'
import { SimpleClass } from './simple-class'

@Module({
  providers: [SimpleClass, AnotherSimpleClass],
  exports: [SimpleClass, AnotherSimpleClass],
})
export class SimpleModule {}
