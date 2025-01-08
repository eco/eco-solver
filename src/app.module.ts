import { Module } from '@nestjs/common'
import { EcoConfigModule } from './eco-configs/eco-config.module'
import { ChainMonitorModule } from './chain-monitor/chain-monitor.module'
import { EcoConfigService } from './eco-configs/eco-config.service'
import { LoggerModule } from 'nestjs-pino'
import { MongooseModule } from '@nestjs/mongoose'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { IntentModule } from './intent/intent.module'
import { IntentSourceModel } from './intent/schemas/intent-source.schema'
import { BalanceModule } from './balance/balance.module'
import { SignModule } from './sign/sign.module'
import { ProverModule } from './prover/prover.module'
import { HealthModule } from './health/health.module'
import { ProcessorModule } from './bullmq/processors/processor.module'
import { SolverModule } from './solver/solver.module'
import { FlagsModule } from './flags/flags.module'
import { LiquidityManagerModule } from '@/liquidity-manager/liquidity-manager.module'
import { ApiModule } from '@/api/api.module'

@Module({
  imports: [
    ApiModule,
    BalanceModule,
    ChainMonitorModule,
    EcoConfigModule.withAWS(),
    EventEmitterModule.forRoot({
      // the delimiter used to segment namespaces
      delimiter: '.',
    }),
    FlagsModule,
    HealthModule,
    IntentModule,
    SignModule,
    IntentSourceModel,
    ProcessorModule,
    MongooseModule.forRootAsync({
      inject: [EcoConfigService],
      useFactory: async (configService: EcoConfigService) => {
        const uri = configService.getMongooseUri()
        return {
          uri,
        }
      },
    }),
    ProverModule,
    SolverModule,
    LiquidityManagerModule,
    ...getPino(),
  ],
  controllers: [],
})
export class AppModule {}

/**
 * Returns the Pino module if the configs have it on ( its off in dev )
 */
function getPino() {
  return EcoConfigService.getStaticConfig().logger.usePino
    ? [
        LoggerModule.forRootAsync({
          inject: [EcoConfigService],
          useFactory: async (configService: EcoConfigService) => {
            const loggerConfig = configService.getLoggerConfig()
            return {
              pinoHttp: loggerConfig.pinoConfig.pinoHttp,
            }
          },
        }),
      ]
    : []
}
