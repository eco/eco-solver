import { BalanceService } from '@eco-solver/balance/balance.service'
import { TransferCommand } from '@eco-solver/commander/transfer/transfer.command'
import { KmsService } from '@eco-solver/kms/kms.service'
import { SignerKmsService } from '@eco-solver/sign/signer-kms.service'
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'

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
