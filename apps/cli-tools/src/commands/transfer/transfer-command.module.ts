import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { KmsService, SignerKmsService } from '@libs/security'
import { KernelAccountClientService } from '@libs/integrations'
import { BalanceService } from '@libs/domain'
import { TransferCommand } from './transfer.command'

@Module({
  imports: [CacheModule.register()],
  providers: [
    TransferCommand,
    KmsService,
    SignerKmsService,
    KernelAccountClientService,
    BalanceService,
  ],
  exports: [
    TransferCommand,
    KmsService,
    SignerKmsService,
    KernelAccountClientService,
    BalanceService,
  ],
})
export class TransferCommandModule {}
