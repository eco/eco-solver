import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from './rhinestone-websocket.service'
import {
  RHINESTONE_EVENTS,
  RhinestoneBundleMessage,
  RhinestonePingMessage,
  RhinestoneRelayerActionV1,
  ChainExecution,
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

  // Listen for Bundle messages
  @OnEvent(RHINESTONE_EVENTS.MESSAGE_BUNDLE)
  handleBundleMessage(message: RhinestoneBundleMessage) {
    this.logger.log(`Received Bundle message: ${JSON.stringify(message)}`)
    // Process the bundle data
  }

  // Listen for Bundle messages
  @OnEvent(RHINESTONE_EVENTS.RELAYER_ACTION_V1)
  handleRelayerAction(message: RhinestoneRelayerActionV1) {
    this.logger.log(`Received RhinestoneRelayerActionV1: ${JSON.stringify(message)}`)
    // Process the bundle data
  }

  // Listen for errors
  @OnEvent(RHINESTONE_EVENTS.ERROR)
  handleError(error: Error) {
    this.logger.error(`WebSocket error: ${error.message}`)
  }

  /**
   * Execute a transaction on the specified chain
   * @param execution The chain execution details
   * @returns The transaction hash
   */
  async executeTransaction(execution: ChainExecution): Promise<Hash> {
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
        value: execution.value,
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
