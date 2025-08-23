import { BalanceCommandModule } from './balance/balance-command.module'
import { EcoConfigCommand } from './eco-config.command'
import { SafeCommandModule } from './safe/safe-command.module'
import { TransferCommandModule } from './transfer/transfer-command.module'
import { EcoConfigModule } from '@libs/solver-config'
import { EcoConfigService } from '@libs/solver-config'
import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'

@Module({
  imports: [
    EcoConfigModule.withAWS(),
    BalanceCommandModule,
    SafeCommandModule,
    TransferCommandModule,
    LoggerModule.forRootAsync({
      inject: [EcoConfigService],
      useFactory: async (configService: EcoConfigService) => {
        const loggerConfig = configService.getLoggerConfig()
        return {
          pinoHttp: {
            ...loggerConfig.pinoConfig.pinoHttp,
            level: 'warn',
          } as any,
        }
      },
    }),
  ],
  providers: [EcoConfigCommand],
})
export class CommanderAppModule {}
