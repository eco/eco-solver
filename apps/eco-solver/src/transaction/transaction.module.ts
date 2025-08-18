import { Module } from '@nestjs/common'
import { SignModule } from '../sign/sign.module'
import { SimpleAccountClientService } from './smart-wallets/simple-account/simple-account-client.service'
import { MultichainPublicClientService } from './multichain-public-client.service'
import { ViemMultichainClientService } from './viem_multichain_client.service'
import { KernelAccountClientService } from './smart-wallets/kernel/kernel-account-client.service'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

@Module({
  imports: [SignModule],
  providers: [
    SimpleAccountClientService,
    MultichainPublicClientService,
    ViemMultichainClientService,
    KernelAccountClientService,
    KernelAccountClientV2Service,
    WalletClientDefaultSignerService,
  ],
  exports: [
    SimpleAccountClientService,
    MultichainPublicClientService,
    KernelAccountClientService,
    KernelAccountClientV2Service,
    WalletClientDefaultSignerService,
  ],
})
export class TransactionModule {}
