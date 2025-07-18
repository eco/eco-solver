import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from './rhinestone-websocket.service'
import {
  RhinestonePingMessage,
  RhinestoneDataMessage,
  RHINESTONE_EVENTS,
} from './rhinestone-websocket.types'

/**
 * Example usage of the RhinestoneWebsocketService
 * This demonstrates how to:
 * 1. Connect to the WebSocket
 * 2. Listen for events
 * 3. Send messages
 */
@Injectable()
export class RhinestoneExampleService implements OnModuleInit {
  private readonly logger = new Logger(RhinestoneExampleService.name)

  constructor(private rhinestoneService: RhinestoneWebsocketService) {}

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

  // Listen for Data messages
  @OnEvent(RHINESTONE_EVENTS.MESSAGE_DATA)
  handleDataMessage(message: RhinestoneDataMessage) {
    this.logger.log(`Received Data message: ${JSON.stringify(message)}`)
    // Process the message data
  }

  // Listen for errors
  @OnEvent(RHINESTONE_EVENTS.ERROR)
  handleError(error: Error) {
    this.logger.error(`WebSocket error: ${error.message}`)
  }

  // Example method to send a message
  async sendMessage(data: any) {
    try {
      await this.rhinestoneService.send({
        type: 'Message',
        data: data,
        id: Math.random().toString(36).substring(7),
      })
    } catch (error) {
      this.logger.error('Failed to send message:', error)
    }
  }

  // Example method to send a ping
  async sendPing() {
    try {
      await this.rhinestoneService.send({
        type: 'Ping',
        timestamp: Date.now(),
      })
    } catch (error) {
      this.logger.error('Failed to send ping:', error)
    }
  }
}
