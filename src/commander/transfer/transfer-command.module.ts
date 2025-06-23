import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { TransferCommand } from '@/commander/transfer/transfer.command'
import { KmsService } from '@/kms/kms.service'
import { SignerKmsService } from '@/sign/signer-kms.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'

@Module({
  imports: [CacheModule.register()],
  providers: [
    TransferCommand,
    KmsService,
    SignerKmsService,
    KernelAccountClientService,
    RpcBalanceService,
  ],
  exports: [
    TransferCommand,
    KmsService,
    SignerKmsService,
    KernelAccountClientService,
    RpcBalanceService,
  ],
})
export class TransferCommandModule {}
