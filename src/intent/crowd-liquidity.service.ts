import { Injectable, Logger } from '@nestjs/common'
import { SignerLike } from '@lit-protocol/types'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { LIT_ABILITY, LIT_CHAINS } from '@lit-protocol/constants'
import {
  createSiweMessage,
  generateAuthSig,
  LitActionResource,
  LitPKPResource,
} from '@lit-protocol/auth-helpers'

import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { privateKeyToAccount } from 'viem/accounts'
import {
  Hex,
  parseSignature,
  PublicClient,
  serializeTransaction,
  TransactionSerializableEIP1559,
} from 'viem'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { IFulfillService } from '@/intent/interfaces/fulfill-service.interface'
import { UtilsIntentService } from '@/intent/utils-intent.service'

@Injectable()
export class CrowdLiquidityService implements IFulfillService {
  private logger = new Logger(CrowdLiquidityService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly publicClient: MultichainPublicClientService,
  ) {}

  async executeFulfillIntent(intentHash: Hex): Promise<void> {
    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}

    if (err) throw err
    if (!data || !model || !solver) return
    if (model.status === 'SOLVED') return

    try {
      return await this.fulfill(Number(model.event.sourceChainID), solver.chainID, intentHash)
    } catch (error) {
      throw error
    }
  }

  async fulfill(sourceChainId: number, destinationChainId: number, intentHash: string) {
    const { capacityTokenId, capacityTokenOwnerPk, kernel, pkp, litNetwork, litActionIpfsId } =
      this.ecoConfigService.getCrowdLiquidity()

    const litNodeClient = new LitNodeClient({
      litNetwork,
      debug: false,
    })
    await litNodeClient.connect()

    // ================ Create capacity delegation AuthSig ================

    const capacityTokenOwner = this.getViemWallet(capacityTokenOwnerPk)

    const { capacityDelegationAuthSig } = await litNodeClient.createCapacityDelegationAuthSig({
      uses: '1',
      dAppOwnerWallet: capacityTokenOwner,
      capacityTokenId: capacityTokenId,
      delegateeAddresses: [pkp.ethAddress],
      expiration: new Date(Date.now() + 1000 * 60 * 5).toISOString(), // 5 minutes
    })

    // ================ Get session sigs ================

    const sessionSigs = await litNodeClient.getSessionSigs({
      pkpPublicKey: pkp.publicKey,
      chain: 'ethereum',
      capabilityAuthSigs: [capacityDelegationAuthSig],
      resourceAbilityRequests: [
        {
          resource: new LitActionResource('*'),
          ability: LIT_ABILITY.LitActionExecution,
        },
        { resource: new LitPKPResource('*'), ability: LIT_ABILITY.PKPSigning },
      ],

      authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
        const toSign = await createSiweMessage({
          uri,
          expiration,
          litNodeClient,
          resources: resourceAbilityRequests,
          walletAddress: await capacityTokenOwner.getAddress(),
          nonce: await litNodeClient.getLatestBlockhash(),
        })

        return generateAuthSig({
          signer: capacityTokenOwner,
          toSign,
        })
      },
    })

    // ================ Execute Lit Action ================

    const publicClient = await this.publicClient.getClient(destinationChainId)

    const [feeData, nonce] = await Promise.all([
      this.getFeeData(publicClient),
      publicClient.getTransactionCount({ address: pkp.ethAddress as Hex }),
    ])

    const transactionBase = { ...feeData, nonce, gasLimit: 1_000_000 }
    const sourceChainName = this.getLitNetworkFromChainId(sourceChainId)

    const litRes = await litNodeClient.executeJs({
      ipfsId: litActionIpfsId,
      sessionSigs,
      jsParams: {
        intentHash,
        publicKey: pkp.publicKey,
        sourceChainName,
        kernelAddress: kernel.address,
        transaction: transactionBase,
        ethAddress: pkp.ethAddress,
      },
    })

    const response = litRes.response as {
      type: number
      maxPriorityFeePerGas: string
      maxFeePerGas: string
      nonce: number
      gasLimit: number
      value: {
        type: 'BigNumber'
        hex: string
      }
      from: string
      to: string
      data: string
      chainId: number
    }

    const unsignedTransaction: TransactionSerializableEIP1559 = {
      type: 'eip1559',
      chainId: response.chainId,
      nonce: response.nonce,
      to: response.to as Hex,
      value: BigInt(response.value.hex),
      data: response.data as Hex,
      gas: BigInt(response.gasLimit),
      maxFeePerGas: BigInt(response.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(response.maxPriorityFeePerGas),
    }

    const serializedTransaction = serializeTransaction(
      unsignedTransaction,
      parseSignature(litRes.signatures.sig.signature),
    )

    await litNodeClient.disconnect()

    await publicClient.sendRawTransaction({ serializedTransaction })
  }

  private getViemWallet(privateKey: string): SignerLike {
    const account = privateKeyToAccount(privateKey as Hex)
    return {
      signMessage(message: string): Promise<string> {
        return account.signMessage({ message })
      },
      getAddress(): Promise<string> {
        return Promise.resolve(account.address)
      },
    }
  }

  private async getFeeData(publicClient: PublicClient) {
    const [block, maxPriorityFeePerGas] = await Promise.all([
      publicClient.getBlock(),
      publicClient.estimateMaxPriorityFeePerGas(),
    ])
    const maxFeePerGas = block.baseFeePerGas! * 2n + maxPriorityFeePerGas

    return {
      type: 2,
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
    }
  }

  private getLitNetworkFromChainId(chainID: number): keyof typeof LIT_CHAINS {
    for (const chainName in LIT_CHAINS) {
      const chain = LIT_CHAINS[chainName]
      if (chain.chainId === chainID) {
        return chainName
      }
    }
    throw new Error('Unknown chain')
  }
}
