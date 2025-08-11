import { ValidSmartWalletService } from "./filters/valid-smart-wallet.service"
import { TransactionModule } from "@libs/integrations"
import { Module } from "@nestjs/common"

@Module({
  imports: [TransactionModule],
  providers: [ValidSmartWalletService],
  exports: [ValidSmartWalletService],
})
export class SolverModule {}
