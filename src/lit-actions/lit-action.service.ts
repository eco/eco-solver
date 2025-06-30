import { Injectable, Logger } from '@nestjs/common'
import { LitActionSdkParams, SignerLike } from '@lit-protocol/types'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { LIT_ABILITY } from '@lit-protocol/constants'
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
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { CrowdLiquidityConfig } from '@/eco-configs/eco-config.types'

export interface LitActionResult {
  response: unknown
  signatures: {
    sig: {
      signature: string
    }
  }
}

@Injectable()
export class LitActionService {
  private logger = new Logger(LitActionService.name)
  private config: CrowdLiquidityConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {
    this.config = this.ecoConfigService.getCrowdLiquidity()
  }

  /**
   * Executes a Lit Action with the given parameters
   * @param ipfsId - The IPFS ID of the Lit Action to execute
   * @param publicClient - The public client for the chain
   * @param params - The parameters to pass to the Lit Action
   * @returns The transaction hash if the action returns a transaction, otherwise the response
   */
  async executeLitAction(
    ipfsId: string,
    publicClient: PublicClient,
    params: LitActionSdkParams['jsParams'],
  ): Promise<Hex | unknown> {
    const { capacityTokenId, capacityTokenOwnerPk, pkp, litNetwork } = this.config

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

        return generateAuthSig({ signer: capacityTokenOwner, toSign })
      },
    })

    // ================ Execute Lit Action ================

    const litRes = await litNodeClient.executeJs({ ipfsId, sessionSigs, jsParams: params })

    await litNodeClient.disconnect()

    // ================ Process Response ================

    if (typeof litRes.response === 'string') {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error processing Lit action',
          properties: { ipfsId, params, error: litRes.response },
        }),
      )

      throw new Error(litRes.response)
    }

    // Check if response is a transaction to be executed
    if (this.isTransactionResponse(litRes)) {
      return this.executeTransaction(litRes, publicClient)
    }

    // Return raw response for other types of Lit actions
    return litRes.response
  }

  /**
   * Executes the fulfill Lit action for crowd liquidity
   * @param intent - The serialized intent object
   * @param publicKey - The PKP public key
   * @param kernelAddress - The kernel wallet address
   * @param transaction - The base transaction parameters
   * @param publicClient - The public client for the chain
   * @returns The transaction hash
   */
  async executeFulfillAction(
    intent: any,
    publicKey: string,
    kernelAddress: string,
    transaction: any,
    publicClient: PublicClient,
  ): Promise<Hex> {
    const params = {
      intent,
      publicKey,
      kernelAddress,
      transaction,
    }

    return this.executeLitAction(this.config.actions.fulfill, publicClient, params) as Promise<Hex>
  }

  /**
   * Executes the rebalance CCTP Lit action
   * @param chainId - The source chain ID
   * @param tokenAddress - The token address on the destination chain
   * @param tokenChainId - The destination chain ID
   * @param publicKey - The PKP public key
   * @param kernelAddress - The kernel wallet address
   * @param transaction - The base transaction parameters
   * @param publicClient - The public client for the chain
   * @returns The transaction hash
   */
  async executeRebalanceCCTPAction(
    chainId: number,
    tokenAddress: Hex,
    tokenChainId: number,
    publicKey: string,
    kernelAddress: string,
    transaction: any,
    publicClient: PublicClient,
  ): Promise<Hex> {
    const params = {
      chainId,
      tokenAddress,
      tokenChainId,
      publicKey,
      kernelAddress,
      transaction,
    }

    return this.executeLitAction(
      this.config.actions.rebalance,
      publicClient,
      params,
    ) as Promise<Hex>
  }

  /**
   * Executes the negative intent rebalance Lit action
   * @param intentHash - The hash of the rebalancing intent
   * @param publicKey - The PKP public key
   * @param kernelAddress - The kernel wallet address
   * @param transaction - The base transaction parameters
   * @param publicClient - The public client for the chain
   * @returns The transaction hash
   */
  async executeNegativeIntentRebalanceAction(
    intentHash: Hex,
    publicKey: string,
    kernelAddress: string,
    transaction: any,
    publicClient: PublicClient,
  ): Promise<Hex> {
    const params = {
      intentHash,
      publicKey,
      kernelAddress,
      transaction,
    }

    // Using the negativeIntentRebalance action
    const ipfsId = this.config.actions.negativeIntentRebalance || this.config.actions.fulfill

    return this.executeLitAction(ipfsId, publicClient, params) as Promise<Hex>
  }

  private isTransactionResponse(litRes: LitActionResult): boolean {
    return !!(
      litRes.response &&
      typeof litRes.response === 'object' &&
      'type' in litRes.response &&
      'chainId' in litRes.response &&
      litRes.signatures?.sig?.signature
    )
  }

  private async executeTransaction(
    litRes: LitActionResult,
    publicClient: PublicClient,
  ): Promise<Hex> {
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
      value: BigInt(response.value.hex ?? response.value ?? 0),
      data: response.data as Hex,
      gas: BigInt(response.gasLimit),
      maxFeePerGas: BigInt(response.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(response.maxPriorityFeePerGas),
    }

    const serializedTransaction = serializeTransaction(
      unsignedTransaction,
      parseSignature(litRes.signatures.sig.signature as Hex),
    )

    return publicClient.sendRawTransaction({ serializedTransaction })
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
}
