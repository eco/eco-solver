import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { Hash } from 'viem'

import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

import { RhinestoneApiService } from './rhinestone-api.service'
import { RhinestoneWebsocketService } from './rhinestone-websocket.service'
import {
  ChainExecution,
  FillAction,
  RHINESTONE_EVENTS,
  RhinestonePingMessage,
  RhinestoneRelayerActionV1,
} from '../types/rhinestone-websocket.types'
import { RhinestoneValidatorService } from '@/rhinestone/services/rhinestone-validator.service'

@Injectable()
export class RhinestoneService implements OnModuleInit {
  private readonly logger = new Logger(RhinestoneService.name)

  constructor(
    private readonly walletClient: WalletClientDefaultSignerService,
    private readonly kernelAccountClient: KernelAccountClientService,
    private readonly rhinestoneApi: RhinestoneApiService,
    private readonly rhinestoneWebsocketService: RhinestoneWebsocketService,
    private readonly rhinestoneValidatorService: RhinestoneValidatorService,
  ) {}

  async onModuleInit() {
    // Connect to the WebSocket server
    await this.rhinestoneWebsocketService.connect()
  }

  // Listen for connection events
  @OnEvent(RHINESTONE_EVENTS.CONNECTED)
  handleConnection() {
    this.logger.log('Connected to Rhinestone WebSocket')
  }

  // Listen for disconnection events
  @OnEvent(RHINESTONE_EVENTS.DISCONNECTED)
  handleDisconnection(payload: { code: number; reason: string }) {
    this.logger.log(`Disconnected from Rhinestone WebSocket: ${payload.code} - ${payload.reason}`)
  }

  // Listen for Ping messages
  @OnEvent(RHINESTONE_EVENTS.MESSAGE_PING)
  handlePingMessage(message: RhinestonePingMessage) {
    this.logger.log(`Received Ping message: ${JSON.stringify(message)}`)
  }

  // Listen for Relayer Action V1 messages
  @OnEvent(RHINESTONE_EVENTS.RELAYER_ACTION_V1)
  async handleRelayerAction(message: RhinestoneRelayerActionV1) {
    this.logger.log(`Received RhinestoneRelayerActionV1: ${JSON.stringify(message)}`)

    // Throws if the message is invalid
    await this.rhinestoneValidatorService.validateRelayerAction(message)

    try {
      const result = await this.executeRelayerAction(message)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Relayer action processed successfully',
          properties: {
            actionId: message.id,
            fillTxHash: result.fillTxHash,
            claimsExecuted: result.claimTxHashes.length,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to process relayer action',
          properties: {
            actionId: message.id,
            error: error.message,
          },
        }),
      )
    }
  }

  // Listen for errors
  @OnEvent(RHINESTONE_EVENTS.ERROR)
  handleError(error: Error) {
    this.logger.error(`WebSocket error: ${error.message}`)
  }

  /**
   * Execute a relayer action's fill and claims in order
   * @param action The relayer action containing the fill details and claims
   * @returns Object containing all transaction hashes
   */
  async executeRelayerAction(action: RhinestoneRelayerActionV1): Promise<{
    fillTxHash: Hash
    claimTxHashes: { id: number; txHash: Hash; beforeFill: boolean }[]
  }> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Executing relayer action ${action.id}`,
        properties: {
          actionId: action.id,
          fillId: action.fill.id,
          claimsCount: action.claims.length,
          chainId: action.fill.call.chainId,
        },
      }),
    )

    const claimTxHashes: { id: number; txHash: Hash; beforeFill: boolean }[] = []

    // Step 1: Execute claims with beforeFill = true
    const beforeFillClaims = action.claims.filter((claim) => claim.beforeFill)
    for (const claim of beforeFillClaims) {
      try {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `Executing beforeFill claim ${claim.id}`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              chainId: claim.call.chainId,
            },
          }),
        )

        const txHash = await this.executeTransaction(claim.call)
        claimTxHashes.push({ id: claim.id, txHash, beforeFill: true })

        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `BeforeFill claim ${claim.id} executed successfully`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              txHash,
            },
          }),
        )
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Failed to execute beforeFill claim ${claim.id}`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              error: error.message,
            },
          }),
        )
        throw error
      }
    }

    // Step 2: Execute the fill with approval
    let fillTxHash: Hash
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Executing fill ${action.fill.id} with approval`,
          properties: {
            actionId: action.id,
            fillId: action.fill.id,
            chainId: action.fill.call.chainId,
          },
        }),
      )

      fillTxHash = await this.executeFillWithApproval(action.fill)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill ${action.fill.id} executed successfully`,
          properties: {
            actionId: action.id,
            fillId: action.fill.id,
            txHash: fillTxHash,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to execute fill ${action.fill.id}`,
          properties: {
            actionId: action.id,
            fillId: action.fill.id,
            error: error.message,
          },
        }),
      )
      throw error
    }

    // Post-fill preconfirmation to Rhinestone API
    try {
      await this.rhinestoneApi.postFillPreconfirmation(
        action.id,
        action.fill.call.chainId,
        fillTxHash,
      )

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Fill preconfirmation posted for action ${action.id}`,
          properties: {
            actionId: action.id,
            txHash: fillTxHash,
          },
        }),
      )
    } catch (error) {
      // Log error but don't fail the transaction
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to post fill preconfirmation`,
          properties: {
            actionId: action.id,
            txHash: fillTxHash,
            error: error.message,
          },
        }),
      )
    }

    // Step 3: Execute remaining claims (beforeFill = false)
    const afterFillClaims = action.claims.filter((claim) => !claim.beforeFill)
    for (const claim of afterFillClaims) {
      try {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `Executing afterFill claim ${claim.id}`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              chainId: claim.call.chainId,
            },
          }),
        )

        const txHash = await this.executeTransaction(claim.call)
        claimTxHashes.push({ id: claim.id, txHash, beforeFill: false })

        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `AfterFill claim ${claim.id} executed successfully`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              txHash,
            },
          }),
        )
      } catch (error) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Failed to execute afterFill claim ${claim.id}`,
            properties: {
              actionId: action.id,
              claimId: claim.id,
              error: error.message,
            },
          }),
        )
        throw error
      }
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Relayer action ${action.id} completed successfully`,
        properties: {
          actionId: action.id,
          fillTxHash,
          claimTxHashesCount: claimTxHashes.length,
        },
      }),
    )

    return {
      fillTxHash,
      claimTxHashes,
    }
  }

  /**
   * Execute a transaction on the specified chain
   * @param execution The chain execution details
   * @returns The transaction hash
   */
  private async executeTransaction(execution: ChainExecution): Promise<Hash> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Executing transaction on chain ${execution.chainId}`,
          properties: {
            chainId: execution.chainId,
            to: execution.to,
            value: execution.value.toString(),
            data: execution.data,
          },
        }),
      )

      const client = await this.walletClient.getClient(execution.chainId)

      const txHash = await client.sendTransaction({
        to: execution.to,
        value: BigInt(execution.value),
        data: execution.data,
        chain: client.chain,
      })

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Transaction sent successfully`,
          properties: {
            chainId: execution.chainId,
            txHash,
          },
        }),
      )

      return txHash
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to execute transaction`,
          properties: {
            chainId: execution.chainId,
            to: execution.to,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Execute a fill transaction with approval
   * @param fill The fill action details
   * @returns The transaction hash
   */
  private async executeFillWithApproval(fill: FillAction): Promise<Hash> {
    try {
      // For now, we'll parse the fill data to determine if approval is needed
      // This is a simplified implementation - in production, you'd want to
      // properly decode the fill data to extract token addresses and amounts

      const transactions: ExecuteSmartWalletArg[] = []

      // TODO: Parse fill.call.data to determine:
      // 1. If this is an ERC20 transfer that needs approval
      // 2. Extract token address, spender address, and amount
      // For now, we'll just execute the fill directly
      // In a real implementation, you would:
      // - Decode the calldata to understand the operation
      // - Check if it's an ERC20 transfer requiring approval
      // - Create approval transaction if needed

      // Example approval transaction (commented out until we can properly parse the fill data):
      // const approvalTx: ExecuteSmartWalletArg = {
      //   to: tokenAddress,
      //   value: 0n,
      //   data: encodeFunctionData({
      //     abi: ERC20Abi,
      //     functionName: 'approve',
      //     args: [spenderAddress, amount],
      //   }),
      // }
      // transactions.push(approvalTx)

      // Add the fill transaction
      const fillTx: ExecuteSmartWalletArg = {
        to: fill.call.to,
        value: BigInt(fill.call.value),
        data: fill.call.data,
      }
      transactions.push(fillTx)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Executing fill with KernelAccountClient`,
          properties: {
            fillId: fill.id,
            chainId: fill.call.chainId,
            transactionCount: transactions.length,
          },
        }),
      )

      const client = await this.kernelAccountClient.getClient(fill.call.chainId)
      return await client.execute(transactions)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to execute fill with approval`,
          properties: {
            fillId: fill.id,
            chainId: fill.call.chainId,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }
}
