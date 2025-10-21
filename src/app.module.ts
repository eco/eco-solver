import { AnalyticsModule } from '@/analytics/analytics.module'
import { ApiModule } from '@/api/api.module'
import { BalanceModule } from '@/balance/balance.module'
import { ChainMonitorModule } from '@/chain-monitor/chain-monitor.module'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeeModule } from '@/fee/fee.module'
import { FlagsModule } from '@/flags/flags.module'
import { getCurrentEnvironment } from '@/analytics/utils'
import { HealthModule } from '@/health/health.module'
import { IntentFulfillmentModule } from '@/intent-fulfillment/intent-fulfillment.module'
import { IntentInitiationModule } from '@/intent-initiation/intent-initiation.module'
import { IntentModule } from '@/intent/intent.module'
import { IntentProcessorModule } from '@/intent-processor/intent-processor.module'
import { IntervalModule } from '@/intervals/interval.module'
import { KmsModule } from '@/kms/kms.module'
import { LiquidityManagerModule } from '@/liquidity-manager/liquidity-manager.module'
import { Logger, Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { MongooseModule } from '@nestjs/mongoose'
import { ProcessorModule } from '@/bullmq/processors/processor.module'
import { ProverModule } from '@/prover/prover.module'
import { QuoteModule } from '@/quote/quote.module'
import { SignModule } from '@/sign/sign.module'
import { SolverModule } from '@/solver/solver.module'
import { SolverRegistrationModule } from '@/solver-registration/solver-registration.module'
import { WatchModule } from '@/watch/watch.module'
import { ModuleRef } from '@nestjs/core'
import { ModuleRefProvider } from '@/common/services/module-ref-provider'
import { RhinestoneModule } from '@/rhinestone/rhinestone.module'

@Module({
  imports: [
    ApiModule,
    AnalyticsModule.withAsyncConfig({
      useFactory: async (configService: EcoConfigService) => {
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
      inject: [EcoConfigService],
    }),
    BalanceModule,
    ChainMonitorModule,
    EcoConfigModule.withAWS(),
    FeeModule,
    FlagsModule,
    HealthModule,
    IntentModule,
    IntentInitiationModule,
    SolverRegistrationModule,
    KmsModule,
    SignModule,
    IntervalModule,
    ProcessorModule,
    MongooseModule.forRootAsync({
      inject: [EcoConfigService],
      useFactory: async (configService: EcoConfigService) => {
        const uri = configService.getMongooseUri()
        return {
          uri,
          // Connection robustness settings
          maxPoolSize: 20,
          minPoolSize: 5,
          serverSelectionTimeoutMS: 10000, // fail fast on bad DNS / no primary
          socketTimeoutMS: 45000, // abort long-hanging operations
          waitQueueTimeoutMS: 5000, // bound pool wait time
          heartbeatFrequencyMS: 10000,
          retryWrites: true,
          appName: 'eco-solver',
          // Log connection lifecycle events
          connectionFactory: (connection) => {
            const logger = new Logger('MongooseConnection')
            connection.on('connected', () => logger.log('MongoDB connected'))
            connection.on('reconnected', () => logger.log('MongoDB reconnected'))
            connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
            connection.on('error', (err) => logger.error('MongoDB connection error', err as any))
            return connection
          },
        }
      },
    }),
    ProverModule,
    QuoteModule,
    SolverModule,
    LiquidityManagerModule,
    WatchModule,
    IntentProcessorModule,
    IntentFulfillmentModule,
    RhinestoneModule,
    ...getPino(),
  ],
  controllers: [],
  providers: [
    {
      provide: 'ModuleRefProviderInit',
      inject: [ModuleRef],
      useFactory: (moduleRef: ModuleRef) => {
        ModuleRefProvider.setModuleRef(moduleRef)
        return true
      },
    },
  ],
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
