import { TransferCommand } from '@/commander/transfer/transfer.command'
import { KmsService } from '@/kms/kms.service'
import { SignerKmsService } from '@/sign/signer-kms.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Module } from '@nestjs/common'

@Module({
  providers: [TransferCommand, KmsService, SignerKmsService, KernelAccountClientService],
  exports: [TransferCommand, KmsService, SignerKmsService, KernelAccountClientService],
})
export class TransferCommandModule {}
