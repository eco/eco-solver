/* eslint-disable prefer-arrow/prefer-arrow-functions */
 
import { AnotherSimpleClass } from './test-classes/another-simple-class'
import { ClassWithAllTheThings } from './test-classes/class-with-all-the-things'
import { ClassWithConfig } from './test-classes/class-with-config'
import { ClassWithDependency } from './test-classes/class-with-dependency'
import { EcoTester } from './eco-tester'
import { SimpleClass } from './test-classes/simple-class'
import { SimpleModule } from './test-classes/simple-module'
import { testMongooseSchema } from './test-classes/test-db-model'

describe('EcoTester', () => {
  function executeSimpleClassTest(
    simpleClass: SimpleClass,
    anotherSimpleClass: AnotherSimpleClass,
  ) {
    const result = simpleClass.doThing('hi')
    const anotherResult = anotherSimpleClass.doThing('bye')

    expect(simpleClass).toBeInstanceOf(SimpleClass)
    expect(anotherSimpleClass).toBeInstanceOf(AnotherSimpleClass)
    expect(result).toEqual('hiDoThing')
    expect(anotherResult).toEqual('byeDoAnotherThing')
  }

  function executeOverrideProviderTest(
    ecoTester: EcoTester,
    objectUnderTest: ClassWithDependency,
    withMock: boolean,
  ) {
    if (withMock) {
      ecoTester.mockOf(SimpleClass).doThing.mockReturnValue('overridden')
    }

    expect(objectUnderTest).toBeInstanceOf(ClassWithDependency)
    expect(objectUnderTest.doThing('hi')).toEqual('hioverridden')
  }

  it('should create instance of object under test and return it', async () => {
    const objUnderTest = await EcoTester.setupTestFor(SimpleClass).init<SimpleClass>()

    const result = objUnderTest.doThing('hi')
    expect(result).toEqual('hiDoThing')
  })

  it('should create instance of object under test and return it when passing by reference', async () => {
    const objUnderTest = [{} as SimpleClass]
    await EcoTester.setupTestFor(SimpleClass).init<SimpleClass>(objUnderTest)
    const [testClass] = objUnderTest
    const result = testClass.doThing('hi')

    expect(result).toEqual('hiDoThing')
  })

  it('should support having more than one test class', async () => {
    const [testClass, anotherTestClass] = await EcoTester.setupTestFor([
      SimpleClass,
      AnotherSimpleClass,
    ]).initMany()

    executeSimpleClassTest(testClass, anotherTestClass)
  })

  it('should support having more than one test class when passing by reference', async () => {
    const $ = EcoTester.setupTestFor([SimpleClass, AnotherSimpleClass])
    const objectsUnderTest = $.objectsUnderTest

    await $.initMany(objectsUnderTest)
    const [simpleClass, anotherSimpleClass] = objectsUnderTest
    executeSimpleClassTest(simpleClass, anotherSimpleClass)
  })

  it('should support multiple test classes with ref tuple', async () => {
    const objectsUnderTest = [
      undefined as unknown as SimpleClass,
      undefined as unknown as AnotherSimpleClass,
    ]

    await EcoTester.setupTestFor([SimpleClass, AnotherSimpleClass]).initMany(objectsUnderTest)

    const [simpleClass, anotherSimpleClass] = objectsUnderTest
    executeSimpleClassTest(simpleClass, anotherSimpleClass)
  })

  // it('should support having more than one test class when passing by reference when they are already defined', async () => {

  //   let simpleClass: SimpleClass
  //   let anotherSimpleClass: AnotherSimpleClass

  //   const objectsUnderTest = [simpleClass, anotherSimpleClass]

  //   await EcoTester
  //     .setupTestFor([SimpleClass, AnotherSimpleClass])
  //     .initMany(objectsUnderTest);

  //   [simpleClass, anotherSimpleClass] = objectsUnderTest
  //   executeSimpleClassTest(simpleClass, anotherSimpleClass)
  // })

  it('should create instance of object with a dependency', async () => {
    const $ = EcoTester.setupTestFor(ClassWithDependency).withProviders(SimpleClass)

    const objectUnderTest = await $.init<ClassWithDependency>()

    const dependency = $.get(SimpleClass)
    expect(objectUnderTest).toBeInstanceOf(ClassWithDependency)
    expect(dependency).toBeInstanceOf(SimpleClass)
    expect(dependency.doThing('hi')).toEqual('hiDoThing')
    expect(objectUnderTest.doThing('hi')).toEqual('hihiDoThing')
  })

  it('should create instance of object with a mocked dependency', async () => {
    const $ = EcoTester.setupTestFor(ClassWithDependency).withMocks([SimpleClass])

    const objectUnderTest = await $.init<ClassWithDependency>()

    expect(objectUnderTest).toBeInstanceOf(ClassWithDependency)
    $.mockOf(SimpleClass).doThing.mockReturnValue('mocked')
    expect(objectUnderTest.doThing('hi')).toEqual('himocked')
    expect($.mockOf(SimpleClass).doThing).toHaveBeenCalledWith('hi')
  })

  it('should create instance of object with a custom mocked dependency', async () => {
    const $ = EcoTester.setupTestFor(ClassWithDependency)
      .customMockFor(SimpleClass)
      .with({ doThing: jest.fn().mockReturnValue('custom') })

    const objectUnderTest = await $.init<ClassWithDependency>()

    expect(objectUnderTest).toBeInstanceOf(ClassWithDependency)
    expect(objectUnderTest.doThing('hi')).toEqual('hicustom')
    expect($.mockOf(SimpleClass).doThing).toHaveBeenCalledWith('hi')
  })

  it('should include a module and be able to override its existing providers', async () => {
    const $ = EcoTester.setupTestFor(ClassWithDependency)
      .withModules(SimpleModule)
      .overridingProvider(SimpleClass)
      .with({ doThing: jest.fn().mockReturnValue('overridden') })

    const objectUnderTest = await $.init<ClassWithDependency>()
    executeOverrideProviderTest($, objectUnderTest, false)
  })

  it('should include a module and be able to override its existing provider with a mock', async () => {
    const $ = EcoTester.setupTestFor(ClassWithDependency)
      .withModules(SimpleModule)
      .overridingProvider(SimpleClass)
      .withMock()

    const objectUnderTest = await $.init<ClassWithDependency>()
    executeOverrideProviderTest($, objectUnderTest, true)
  })

  it('should include a module and be able to override its existing providers with automocks', async () => {
    const $ = EcoTester.setupTestFor(ClassWithDependency)
      .withModules(SimpleModule)
      .overridingProvidersWithMocks(SimpleClass)

    const objectUnderTest = await $.init<ClassWithDependency>()
    executeOverrideProviderTest($, objectUnderTest, true)
  })

  it('should include a module and be able to override its existing providers', async () => {
    const $ = EcoTester.setupTestFor(ClassWithDependency)
      .withModules(SimpleModule)
      .overridingProvider(SimpleClass)
      .with({ doThing: jest.fn().mockReturnValue('overridden') })

    const objectUnderTest = await $.init<ClassWithDependency>()
    executeOverrideProviderTest($, objectUnderTest, false)
  })

  it.skip('should support adding config', async () => {
    const config = { yes: ['hello, this'], is: 'config' }
    const $ = EcoTester.setupTestFor(ClassWithConfig).withConfig(config)

    const objectUnderTest = await $.init<ClassWithConfig>()

    expect(objectUnderTest.gimmeConfig()).toEqual(expect.objectContaining(config))
    expect(objectUnderTest).toBeInstanceOf(ClassWithConfig)
  })

  it.skip('should support building a more complex test object', async () => {
    const $ = EcoTester.setupTestFor([ClassWithAllTheThings, ClassWithConfig])
      .withMocks(ClassWithDependency)
      .withProviders(SimpleClass)
      .customMockFor(AnotherSimpleClass)
      .with({ doThing: jest.fn().mockReturnValue('custom') })
      .withSchemas([['testSchema', testMongooseSchema]])
      .withDefaultConfig()

    const [classWithAllTheThings, classWithConfig] = (await $.initMany()) as [
      ClassWithAllTheThings,
      ClassWithConfig,
    ]

    $.mockOf(ClassWithDependency).doThing.mockReturnValue('mocked')

    expect(classWithAllTheThings).toBeInstanceOf(ClassWithAllTheThings)
    expect(classWithConfig).toBeInstanceOf(ClassWithConfig)
    expect(classWithAllTheThings.simpleDependency).toBeInstanceOf(SimpleClass)
    expect($.get(AnotherSimpleClass).doThing('hi')).toEqual('custom')
    expect(classWithAllTheThings.doThing('hi')).toEqual('hihiDoThingcustommocked')
    expect($.mockOf(ClassWithDependency).doThing).toHaveBeenCalledWith('hi')
  })
})
