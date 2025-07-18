import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from './rhinestone-websocket.service'
import { RhinestoneApiService } from './rhinestone-api.service'
import {
  ChainExecution,
  RHINESTONE_EVENTS,
  RhinestonePingMessage,
  RhinestoneRelayerActionV1,
} from '../types/rhinestone-websocket.types'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { Hash } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

@Injectable()
export class RhinestoneService implements OnModuleInit {
  private readonly logger = new Logger(RhinestoneService.name)

  constructor(
    private readonly rhinestoneService: RhinestoneWebsocketService,
    private readonly walletClient: WalletClientDefaultSignerService,
    private readonly rhinestoneApi: RhinestoneApiService,
  ) {}

  async onModuleInit() {
    // Connect to the WebSocket server
    await this.rhinestoneService.connect()
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

    // Step 2: Execute the fill
    let fillTxHash: Hash
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Executing fill ${action.fill.id}`,
          properties: {
            actionId: action.id,
            fillId: action.fill.id,
            chainId: action.fill.call.chainId,
          },
        }),
      )

      fillTxHash = await this.executeTransaction(action.fill.call)

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
}
