import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { EcoConfigModule, EcoConfigService } from '@libs/integrations'
import { BalanceCommandModule } from './balance/balance-command.module'
import { SafeCommandModule } from './safe/safe-command.module'
import { TransferCommandModule } from './transfer/transfer-command.module'
import { EcoConfigCommand } from './eco-config.command'

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
          },
        }
      },
    }),
  ],
  providers: [EcoConfigCommand],
})
export class CommanderAppModule {}
