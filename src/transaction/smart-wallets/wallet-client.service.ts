import { Injectable } from '@nestjs/common'
import {
  Chain,
  createPublicClient,
  createWalletClient,
  extractChain,
  ParseAccount,
  PrivateKeyAccount,
  Transport,
  WalletClient,
  WalletClientConfig,
} from 'viem'
import { SignerService } from '@/sign/signer.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { ViemMultichainClientService } from '../viem_multichain_client.service'
import { EcoResponse } from '@/common/eco-response'
import { ChainsSupported } from '@/common/chains/supported'
import { batchTransactionsWithMulticall } from '@/common/multicall/multicall3'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { EstimatedGasData } from '@/transaction/smart-wallets/kernel/interfaces/estimated-gas-data.interface'

export abstract class WalletClientService<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain,
  accountOrAddress extends PrivateKeyAccount = PrivateKeyAccount,
  instance extends WalletClient<
    transport,
    chain,
    ParseAccount<accountOrAddress>,
    undefined
  > = WalletClient<transport, chain, ParseAccount<accountOrAddress>, undefined>,
  config extends WalletClientConfig<
    transport,
    chain,
    accountOrAddress,
    undefined
  > = WalletClientConfig<transport, chain, accountOrAddress, undefined>,
> extends ViemMultichainClientService<instance, config> {
  async getPublicClient(chainID: number) {
    const chain = extractChain({
      chains: ChainsSupported,
      id: chainID,
    })

    const config = await super.buildChainConfig(chain)

    return createPublicClient(config)
  }

  abstract getAccount(): Promise<accountOrAddress>

  protected override async createInstanceClient(configs: config): Promise<instance> {
    return createWalletClient(configs) as instance
  }

  protected override async buildChainConfig(chain: Chain): Promise<config> {
    const base = await super.buildChainConfig(chain)
    return {
      ...base,
      account: await this.getAccount(),
    }
  }
}

@Injectable()
export class WalletClientDefaultSignerService extends WalletClientService {
  constructor(
    readonly ecoConfigService: EcoConfigService,
    private readonly signerService: SignerService,
  ) {
    super(ecoConfigService)
  }

  getAccount(): Promise<PrivateKeyAccount> {
    return Promise.resolve(this.signerService.getAccount())
  }

  async estimateGas(
    chainID: number,
    transactions: ExecuteSmartWalletArg[],
  ): Promise<EcoResponse<EstimatedGasData>> {
    const publicClient = await this.getPublicClient(chainID)

    const transaction = batchTransactionsWithMulticall(chainID, transactions)

    // Simulate the contract execution to estimate gas
    const gasEstimate = await publicClient.estimateGas({
      account: await this.getAccount(),
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
    })

    const gasPrice = await publicClient.getGasPrice()

    return {
      response: {
        chainID,
        gasEstimate,
        gasPrice,
        gasCost: gasPrice * gasEstimate,
      },
    }
  }
}
