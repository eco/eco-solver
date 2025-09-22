/* eslint-disable prettier/prettier */
/* eslint-disable consistent-this */
/* eslint-disable no-use-before-define */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable max-classes-per-file */
import { Abstract, INestApplication } from '@nestjs/common/interfaces'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { DynamicModule, Provider } from '@nestjs/common'
import { EcoTesterHttp } from './eco-tester-http'
import {
  mongooseWithSchemas,
  provideAndMock,
  provideEcoConfigServiceWithStatic,
} from '../nest-mock-utils'
import { Queue } from 'bullmq'
import { Test, TestingModule } from '@nestjs/testing'
import { Type } from '@nestjs/common/interfaces/type.interface'

export type EcoTesterTuple = [...any[]]

export class EcoTester {
  public testModule: TestingModule
  public http: EcoTesterHttp

  private objectsToTest: any | EcoTesterTuple
  private config?: any

  private controllers: Array<Type<any>> = []
  private providers: Provider[] = []
  private mocks: Provider[] = []
  private imports: DynamicModule[] = []
  private queuesToMock: string[]
  public providersToOverride: Array<[Provider | string, any]> = []

  private userID: string

  public set mockAuthedUserID(userID: string) {
    this.userID = userID
  }

  private nestApp: INestApplication

  public get app(): INestApplication {
    if (this.nestApp) {
      return this.nestApp
    }
    throw new Error('App not initialized - make sure to call initApp() first')
  }

  private constructor(objectsToTest: any | EcoTesterTuple) {
    if (objectsToTest.name?.endsWith('Module')) {
      this.imports.push(objectsToTest)
      return
    }

    this.objectsToTest = objectsToTest
    const objsArray = Array.isArray(this.objectsToTest) ? this.objectsToTest : [this.objectsToTest]

    for (const obj of objsArray) {
      if (obj.name.endsWith('Controller')) {
        this.controllers.push(obj)
      } else {
        this.providers.push(obj)
      }
    }
  }

  public get objectsUnderTest(): EcoTesterTuple {
    return [...this.objectsToTest.map((obj) => ({}) as typeof obj)]
  }

  public get<TInput = any, TResult = TInput>(
    typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol,
  ): TResult {
    const provider = this.testModule.get<TInput, TResult>(typeOrToken)
    if (!provider) {
      throw new Error(
        `Cannot find provider for ${typeOrToken.toString()} - make sure to init() first`,
      )
    }
    return provider
  }

  public mockOfQueue(queueName: string): DeepMocked<Queue> {
    return this.mockOf(getQueueToken(queueName))
  }

  public mockOf<TInput = any, TResult = TInput>(
    typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol,
  ): DeepMocked<TResult> {
    const mock = this.testModule.get<TInput, TResult>(typeOrToken) as DeepMocked<TResult>
    if (!mock) {
      throw new Error(`Cannot find mock for ${String(typeOrToken)} - make sure to init() first`)
    }

    return mock
  }

  public static setupTestFor(
    objectsToTest: any | EcoTesterTuple,
    refTuple?: EcoTesterTuple,
  ): EcoTester {
    const testBuilder = new EcoTester(objectsToTest)

    const objsArray = Array.isArray(objectsToTest) ? objectsToTest : [objectsToTest]
    refTuple = []

    objsArray.forEach((obj, index) => {
      refTuple[index] = obj
    })

    return testBuilder
  }

  public static setupTestForModule(module: any): EcoTester {
    if (!module.name.endsWith('Module')) {
      throw new Error('Invalid module')
    }
    const testBuilder = new EcoTester(module)
    return testBuilder
  }

  public static setupTest(): EcoTester {
    return new EcoTester([])
  }

  public withProviders(providersToTest: Provider[] | Provider): EcoTester {
    const providers = Array.isArray(providersToTest) ? providersToTest : [providersToTest]

    this.providers.push(...providers)
    return this
  }

  public overridingProvider(provider: Provider | string): EcoTesterWith {
    return new this.EcoTesterOverrideWith(provider)
  }

  public overridingProvidersWithMocks(...providers: any): EcoTester {
    providers.forEach((provider) => {
      this.providersToOverride.push([provider, createMock(provider)])
    })
    return this
  }

  public withMocks(providersToMock: any[] | any): EcoTester {
    const mocks = Array.isArray(providersToMock) ? providersToMock : [providersToMock]
    this.mocks.push(...mocks.map((provider) => provideAndMock(provider)))
    return this
  }

  public customMockFor(provider: any): EcoTesterWith {
    return new this.EcoTesterCustomImplementation(provider)
  }

  public withModules(imports: any | any[]): EcoTester {
    const importsArray = Array.isArray(imports) ? imports : [imports]
    this.imports.push(...importsArray)
    return this
  }

  public withQueues(queuesToMock: string | string[]): EcoTester {
    const queuesArray = Array.isArray(queuesToMock) ? queuesToMock : [queuesToMock]
    this.queuesToMock = queuesArray
    queuesArray.forEach((queueToAdd) => {
      const options = {
        name: queueToAdd,
        prefix: `{${queueToAdd}}`,
      }
      this.imports.push(BullModule.registerQueue(options))
    })
    return this
  }

  public withSchemas(schemasToMock: [string, any] | Array<[string, any]>): EcoTester {
    const schemasArray = Array.isArray(schemasToMock) ? schemasToMock : [schemasToMock]
    this.imports.push(...mongooseWithSchemas([...schemasArray]))

    return this
  }

  public withMockedAuthForUser(userID: string): EcoTester {
    this.userID = userID
    return this
  }

  public withConfig(config: any): EcoTester {
    this.config = config
    this.providers.push(provideEcoConfigServiceWithStatic(this.config))
    return this
  }

  public withDefaultConfig(): EcoTester {
    this.providers.push(provideEcoConfigServiceWithStatic({}))
    return this
  }

  private async initInternal(): Promise<void> {
    const builder = Test.createTestingModule({
      controllers: this.controllers,
      imports: this.imports,
      providers: [...this.providers, ...this.mocks],
    })

    if (this.providersToOverride) {
      this.providersToOverride.forEach(([provider, value]) => {
        builder.overrideProvider(provider).useValue(value)
      })
    }

    if (this.queuesToMock) {
      this.queuesToMock.forEach((queueName) =>
        builder.overrideProvider(getQueueToken(queueName)).useValue(createMock<Queue>()),
      )
    }

    this.testModule = await builder.compile()

    await this.testModule.init()
  }

  public async init<T>(obj?: EcoTesterTuple): Promise<T> {
    await this.initInternal()

    if (!Array.isArray(this.objectsToTest) && !obj) {
      return await this.get(this.objectsToTest)
    }

    if (obj && obj.length === 1) {
      obj[0] = this.get(this.objectsToTest)
      return await this.get(this.objectsToTest)
    }

    throw new Error('Cannot init() when multiple objects under test are provided')
  }

  public async initMany(objs?: EcoTesterTuple): Promise<EcoTesterTuple> {
    await this.initInternal()
    if (Array.isArray(this.objectsToTest) && !objs) {
      return this.objectsToTest.map((obj) => this.get(obj))
    }

    if (Array.isArray(this.objectsToTest) && objs!.length === this.objectsToTest.length) {
      return this.objectsToTest.map((obj, index) => {
        const objResolved = this.get(obj)
        objs![index] = objResolved
        return objResolved
      })
    }

    throw new Error('Cannot initMany() when only one object under test is provided')
  }

  public async initApp(): Promise<INestApplication> {
    await this.initInternal()
    this.nestApp = this.testModule.createNestApplication()
    await this.nestApp.init()
    this.http = new EcoTesterHttp(this.nestApp)
    return this.nestApp
  }

  public EcoTesterOverrideWith = (() => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const tester = this

    class EcoTesterOverrideWith implements EcoTesterWith {
      constructor(public provider: Provider | string) {}

      public with(value: any): EcoTester {
        tester.providersToOverride.push([this.provider, value])
        return tester
      }

      public withMock(): EcoTester {
        const mock = createMock<Provider>()
        tester.providersToOverride.push([this.provider, mock])
        return tester
      }

      public useFactory(factory: () => any): EcoTester {
        const value = factory()
        tester.providersToOverride.push([this.provider, value])
        return tester
      }
    }
    return EcoTesterOverrideWith
  })()

  public EcoTesterCustomImplementation = (() => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const tester = this

    class EcoTesterCustomImplementation implements EcoTesterWith {
      constructor(public provider: Provider) {}

      public with(mock: any): EcoTester {
        tester.mocks.push(provideAndMock(this.provider, mock))
        return tester
      }

      public withMock(): EcoTester {
        const mock = createMock<Provider>()
        tester.providersToOverride.push([this.provider, mock])
        return tester
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      public useFactory(factory: () => any): EcoTester {
        throw new Error('useFactory is not supported in EcoTesterCustomImplementation')
      }
    }
    return EcoTesterCustomImplementation
  })()
}

export interface EcoTesterWith {
  with(value: any): EcoTester
  withMock(): EcoTester
  useFactory(factory: () => any): EcoTester
}
