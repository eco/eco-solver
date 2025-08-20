import { BalanceCommandModule } from '@eco-solver/commander/balance/balance-command.module'
import { EcoConfigCommand } from '@eco-solver/commander/eco-config.command'
import { SafeCommandModule } from '@eco-solver/commander/safe/safe-command.module'
import { TransferCommandModule } from '@eco-solver/commander/transfer/transfer-command.module'
import { EcoConfigModule } from '@libs/config-core'
import { EcoConfigService } from '@libs/config-core'
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
