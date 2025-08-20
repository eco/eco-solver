/* eslint-disable prettier/prettier */

import { createMock } from '@golevelup/ts-jest'
import { DynamicModule, Provider } from '@nestjs/common'
import { EcoConfigModule } from '../../eco-configs/eco-config.module'
import { EcoConfigService } from '@libs/eco-solver-config'
import { MongooseModule } from '@nestjs/mongoose'

export function provideEcoConfigService(ecoConfig: any): Provider {
  return {
    provide: EcoConfigService,
    useValue: { getConfig: () => ecoConfig },
  }
}

export function provideEcoConfigServiceWithStatic(ecoConfig: any): Provider {
  const staticConfig = EcoConfigService.getStaticConfig()
  return provideEcoConfigService({ ...staticConfig, ...ecoConfig })
}

export function provideAndMock(type: any, options?: any): Provider {
  const provider = {
    provide: type,
    useValue: createMock<typeof type>(options),
  }

  return provider
}

export function mongooseWithSchemas(schemas: Array<[string, any]>): DynamicModule[] {
  const root = [
    MongooseModule.forRootAsync({
      imports: [EcoConfigModule],
      useFactory: () => {
        return {
          uri: process.env.MONGO_URL,
          autoCreate: false,
          autoIndex: false,
        }
      },
    }),
  ]

  schemas.forEach(([name, schema]) => {
    root.push(MongooseModule.forFeature([{ name, schema }]))
  })

  return root
}
