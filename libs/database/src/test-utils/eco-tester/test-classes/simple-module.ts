@Module({
  providers: [SimpleClass, AnotherSimpleClass],
  exports: [SimpleClass, AnotherSimpleClass],
})
export class SimpleModule {}
