import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { MongooseModule } from '@nestjs/mongoose'
import { LiquidityManagerModule } from '@eco-solver/liquidity-manager/liquidity-manager.module'
import { ApiModule } from '@eco-solver/api/api.module'
import { WatchModule } from '@eco-solver/watch/watch.module'
import { IntervalModule } from '@eco-solver/intervals/interval.module'
import { QuoteModule } from '@eco-solver/quote/quote.module'
import { FeeModule } from '@eco-solver/fee/fee.module'
import { KmsModule } from '@eco-solver/kms/kms.module'
import { IntentProcessorModule } from '@eco-solver/intent-processor/intent-processor.module'
import { BalanceModule } from '@eco-solver/balance/balance.module'
import { ChainMonitorModule } from '@eco-solver/chain-monitor/chain-monitor.module'
import { EcoSolverConfigModule, EcoSolverConfigService } from '@libs/solver-config'
import { FlagsModule } from '@eco-solver/flags/flags.module'
import { HealthModule } from '@eco-solver/health/health.module'
import { IntentModule } from '@eco-solver/intent/intent.module'
import { SignModule } from '@eco-solver/sign/sign.module'
import { ProcessorModule } from '@eco-solver/bullmq/processors/processor.module'
import { AnalyticsModule } from '@eco-solver/analytics/analytics.module'
import { getCurrentEnvironment } from '@eco-solver/analytics/utils'
import { ProverModule } from '@eco-solver/prover/prover.module'
import { SolverModule } from '@eco-solver/solver/solver.module'
import { PermitProcessingModule } from '@eco-solver/permit-processing/permit-processing.module'
import { IntentInitiationModule } from '@eco-solver/intent-initiation/intent-initiation.module'
import { SolverRegistrationModule } from '@eco-solver/solver-registration/solver-registration.module'
import { IntentFulfillmentModule } from '@eco-solver/intent-fulfillment/intent-fulfillment.module'

@Module({
  imports: [
    ApiModule,
    AnalyticsModule.withAsyncConfig({
      useFactory: async (configService: EcoSolverConfigService) => {
        const analyticsConfig = configService.getAnalyticsConfig()

        // Get the current environment for group identification
        const environment = getCurrentEnvironment()

        return {
          ...analyticsConfig,
          // Set environment-based group context for analytics
          groups: {
            environment: environment,
          },
        }
      },
      inject: [EcoSolverConfigService],
    }),
    BalanceModule,
    ChainMonitorModule,
    EcoSolverConfigModule.withAWS(),
    FeeModule,
    FlagsModule,
    HealthModule,
    IntentModule,
    PermitProcessingModule,
    IntentInitiationModule,
    SolverRegistrationModule,
    KmsModule,
    SignModule,
    IntervalModule,
    ProcessorModule,
    MongooseModule.forRootAsync({
      inject: [EcoSolverConfigService],
      useFactory: async (configService: EcoSolverConfigService) => {
        const uri = configService.getMongooseUri()
        return { uri }
      },
    }),
    ProverModule,
    QuoteModule,
    SolverModule,
    LiquidityManagerModule,
    WatchModule,
    IntentProcessorModule,
    IntentFulfillmentModule,
    ...getPino(),
  ],
  controllers: [],
})
export class AppModule {}

/**
 * Returns the Pino module if the configs have it on ( its off in dev )
 */
function getPino() {
  // Use static config to determine if Pino should be enabled
  const staticConfig = require('@libs/solver-config').getStaticSolverConfig()
  return staticConfig.logger?.usePino
    ? [
        LoggerModule.forRootAsync({
          inject: [EcoSolverConfigService],
          useFactory: async (configService: EcoSolverConfigService) => {
            const loggerConfig = configService.getLoggerConfig()
            return {
              pinoHttp: loggerConfig?.pinoConfig?.pinoHttp,
            }
          },
        }),
      ]
    : []
}
