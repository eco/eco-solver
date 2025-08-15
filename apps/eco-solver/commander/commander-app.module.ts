import { BalanceCommandModule } from '@/commander/balance/balance-command.module'
import { EcoConfigCommand } from '@/commander/eco-config.command'
import { SafeCommandModule } from '@/commander/safe/safe-command.module'
import { TransferCommandModule } from '@/commander/transfer/transfer-command.module'
import { EcoConfigModule } from '@eco/infrastructure-config'
import { EcoConfigService } from '@eco/infrastructure-config'
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
          },
        }
      },
    }),
  ],
  providers: [EcoConfigCommand],
})
export class CommanderAppModule {}
