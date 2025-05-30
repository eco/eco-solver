import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { MongooseModule } from '@nestjs/mongoose'
import { LiquidityManagerModule } from '@/liquidity-manager/liquidity-manager.module'
import { ApiModule } from '@/api/api.module'
import { WatchModule } from '@/watch/watch.module'
import { IntervalModule } from '@/intervals/interval.module'
import { QuoteModule } from '@/quote/quote.module'
import { FeeModule } from '@/fee/fee.module'
import { KmsModule } from '@/kms/kms.module'
import { IntentProcessorModule } from '@/intent-processor/intent-processor.module'
import { BalanceModule } from '@/balance/balance.module'
import { ChainMonitorModule } from '@/chain-monitor/chain-monitor.module'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { FlagsModule } from '@/flags/flags.module'
import { HealthModule } from '@/health/health.module'
import { IntentModule } from '@/intent/intent.module'
import { SignModule } from '@/sign/sign.module'
import { ProcessorModule } from '@/bullmq/processors/processor.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { ProverModule } from '@/prover/prover.module'
import { SolverModule } from '@/solver/solver.module'
import { PermitProcessingModule } from '@/permit-processing/permit-processing.module'
import { IntentInitiationModule } from '@/intent-initiation/intent-initiation.module'
import { SolverRegistrationModule } from '@/solver-registration/solver-registration.module'

@Module({
  imports: [
    // Core modules - always loaded
    EcoConfigModule.withAWS(),
    HealthModule,
    ApiModule,
    BalanceModule,
    FeeModule,
    FlagsModule,
    IntentModule,
    PermitProcessingModule,
    IntentInitiationModule,
    SolverRegistrationModule,
    KmsModule,
    SignModule,
    ProverModule,
    QuoteModule,
    SolverModule,
    KmsModule,
    WatchModule,
    IntentProcessorModule,
    IntervalModule,
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
    ...getPino(),
    // Heavy modules - conditionally loaded
    ...getHeavyModules(),
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

/**
 * Returns heavy modules conditionally based on SKIP_HEAVY_INIT environment variable
 * Set SKIP_HEAVY_INIT=true to skip loading heavy modules for faster development startup
 */
function getHeavyModules() {
  const skipHeavyInit = process.env.SKIP_HEAVY_INIT === 'true'

  if (skipHeavyInit) {
    // Fast startup mode - skip heavy modules
    return []
  }

  return [ChainMonitorModule, LiquidityManagerModule]
}
