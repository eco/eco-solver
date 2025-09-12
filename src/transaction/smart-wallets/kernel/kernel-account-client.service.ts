import { Injectable } from '@nestjs/common'
import { ViemMultichainClientService } from '../../viem_multichain_client.service'
import { entryPoint07Address } from 'viem/account-abstraction'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import {
  Account,
  Chain,
  encodeFunctionData,
  Hex,
  LocalAccount,
  OneOf,
  Transport,
  WalletClient,
  zeroAddress,
} from 'viem'
import { KernelAccountClientConfig } from './kernel-account.config'
import { KernelVersion } from 'permissionless/accounts'
import {
  addExecutorToKernelAccount,
  createKernelAccountClient,
  entryPointV_0_7,
} from './create.kernel.account'
import { KernelAccountClient } from './kernel-account.client'
import { EthereumProvider } from 'permissionless/utils/toOwner'
import { TransactionLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { SignerKmsService } from '@/sign/signer-kms.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoResponse } from '@/common/eco-response'
import { EstimatedGasData } from '@/transaction/smart-wallets/kernel/interfaces/estimated-gas-data.interface'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { KernelExecuteAbi } from '@/contracts'

@Injectable()
export class KernelAccountClientServiceBase<
  entryPointVersion extends '0.6' | '0.7',
  kernelVersion extends KernelVersion<entryPointVersion>,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  >,
> extends ViemMultichainClientService<
  KernelAccountClient<entryPointVersion>,
  KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>
> {
  protected logger = new TransactionLogger('KernelAccountClientService')

  constructor(
    readonly ecoConfigService: EcoConfigService,
    private readonly signerService: SignerKmsService,
  ) {
    super(ecoConfigService)
  }

  protected override async createInstanceClient(
    configs: KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>,
  ): Promise<KernelAccountClient<entryPointVersion>> {
    const { client, args } = await createKernelAccountClient(configs)
    if (args && args.deployReceipt) {
      this.logger.log(
        {
          transactionHash: args.deployReceipt,
          operationType: 'smart_wallet_deploy',
          status: 'completed',
          walletAddress: client.kernelAccount.address,
        },
        'Deploying Kernel Account',
        {
          kernelAccount: client.kernelAccount.address,
        },
      )
    }
    const owner = this.ecoConfigService.getSafe().owner
    if (owner) {
      //Conditionally adds an OwnableExecutor to the Kernel Account
      await addExecutorToKernelAccount(client, owner)
    }

    return client
  }

  protected override async buildChainConfig(
    chain: Chain,
  ): Promise<KernelAccountClientConfig<entryPointVersion, kernelVersion, owner>> {
    const base = await super.buildChainConfig(chain)
    return {
      ...base,
      account: this.signerService.getAccount(),
      useMetaFactory: false,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7' as entryPointVersion,
      },
      owners: [this.signerService.getAccount() as owner],
      index: 0n, // optional
    }
  }
  /**
   * Returns the address of the wallet for the first solver in the config.
   * @returns
   */
  public override async getAddress(): Promise<Hex> {
    const solvers = this.ecoConfigService.getSolvers()
    if (!solvers || Object.values(solvers).length == 0) {
      return zeroAddress
    }

    const clientKernel = await this.getClient(Object.values(solvers)[0].chainID)
    return clientKernel.kernelAccount?.address
  }
}

@Injectable()
export class KernelAccountClientService extends KernelAccountClientServiceBase<
  entryPointV_0_7,
  KernelVersion<entryPointV_0_7>,
  LocalAccount
> {
  constructor(ecoConfigService: EcoConfigService, signerService: SignerKmsService) {
    super(ecoConfigService, signerService)
  }

  @LogOperation('gas_estimation', TransactionLogger)
  async estimateGasForKernelExecution(
    @LogContext chainID: number,
    @LogContext transactions: ExecuteSmartWalletArg[],
  ): Promise<EcoResponse<EstimatedGasData>> {
    try {
      const clientKernel = await this.getClient(chainID)
      const kernelAddress = clientKernel.kernelAccount?.address

      // Encode the execute function call with the batch of transactions
      const callData = encodeFunctionData({
        abi: KernelExecuteAbi,
        functionName: 'executeBatch',
        args: [
          transactions.map((tx) => ({
            to: tx.to,
            value: tx.value ?? 0n,
            data: tx.data ?? '0x',
          })),
        ],
      })

      // Simulate the contract execution to estimate gas
      const gasEstimate = await clientKernel.estimateGas({
        account: kernelAddress,
        to: kernelAddress,
        data: callData,
      })

      const gasPrice = await clientKernel.getGasPrice()

      return {
        response: {
          gasEstimate,
          gasPrice,
        },
      }
    } catch (ex) {
      return { error: EcoError.GasEstimationError }
    }
  }
}
