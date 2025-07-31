import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import * as WebSocket from 'ws'
import {
  RHINESTONE_EVENTS,
  RhinestoneBundleMessage,
  RhinestoneMessage,
  RhinestoneMessageType,
  RhinestonePingMessage,
  RhinestoneRelayerActionV1,
} from '../types/rhinestone-websocket.types'
import { RhinestoneConfigService } from '@/rhinestone/services/rhinestone-config.service'

/**
 * Configuration for the Rhinestone WebSocket connection
 */
export interface RhinestoneWebsocketConfig {
  url: string
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  pingInterval?: number
  headers?: Record<string, string>
}

/**
 * Service for managing WebSocket connections to the Rhinestone orchestrator.
 * Handles connection lifecycle, message parsing, and automatic reconnection.
 */
@Injectable()
export class RhinestoneWebsocketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RhinestoneWebsocketService.name)
  private ws: WebSocket | null = null
  private config: RhinestoneWebsocketConfig
  private reconnectAttempts = 0
  private reconnectTimeout: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private isIntentionallyClosed = false

  constructor(
    private eventEmitter: EventEmitter2,
    private rhinestoneConfigService: RhinestoneConfigService,
  ) {
    // Initialize configuration from EcoConfigService
    const rhinestoneWebsocketConfig = this.rhinestoneConfigService.getWebsocket()
    this.config = {
      url: rhinestoneWebsocketConfig.url,
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
    }
  }

  /**
   * Module initialization - service is ready but won't connect until explicitly called
   */
  async onModuleInit() {
    // Service is ready but won't connect until explicitly called
    this.logger.log('RhinestoneWebsocketService initialized')
  }

  /**
   * Module cleanup - ensures WebSocket is properly disconnected
   */
  async onModuleDestroy() {
    await this.disconnect()
  }

  /**
   * Establish WebSocket connection to the Rhinestone orchestrator
   * @throws {Error} If connection fails
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.logger.warn('WebSocket is already connected')
      return
    }

    this.isIntentionallyClosed = false
    this.logger.log(`Connecting to WebSocket at ${this.config.url}`)

    try {
      this.ws = new WebSocket(this.config.url, {
        headers: this.config.headers,
      })

      this.setupEventHandlers()
    } catch (error) {
      this.logger.error(`Failed to create WebSocket connection: ${error}`)
      throw error
    }
  }

  /**
   * Send a message through the WebSocket connection
   * @param message The message to send (will be stringified if not already a string)
   * @throws {Error} If WebSocket is not connected
   */
  async send(message: any): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message)

    return new Promise((resolve, reject) => {
      this.ws!.send(messageStr, (error) => {
        if (error) {
          this.logger.error(`Failed to send message: ${error}`)
          reject(error)
        } else {
          this.logger.debug(`Message sent: ${messageStr}`)
          resolve()
        }
      })
    })
  }

  /**
   * Disconnect the WebSocket connection and clean up resources
   */
  async disconnect(): Promise<void> {
    this.isIntentionallyClosed = true

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.stopPingInterval()

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close()
        this.logger.log('WebSocket connection closed')
      }
      this.ws = null
    }
  }

  /**
   * Check if WebSocket is currently connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * Get the current WebSocket ready state
   * @returns WebSocket ready state or null if not initialized
   */
  getReadyState(): number | null {
    return this.ws ? this.ws.readyState : null
  }

  /**
   * Set up WebSocket event handlers for open, message, close, error, ping, and pong events
   */
  private setupEventHandlers() {
    if (!this.ws) return

    this.ws.on('open', () => {
      this.logger.log('WebSocket connection established')
      this.reconnectAttempts = 0
      this.startPingInterval()
      this.eventEmitter.emit(RHINESTONE_EVENTS.CONNECTED)
    })

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        this.logger.debug(`Received raw message: ${data.toString()}`)

        const message = this.parseMessage(data)
        this.logger.debug(`Received message: ${JSON.stringify(message)}`)

        // Emit type-safe events based on message type
        switch (message.type) {
          case RhinestoneMessageType.Ping:
            this.eventEmitter.emit(RHINESTONE_EVENTS.MESSAGE_PING, message as RhinestonePingMessage)
            break
          case RhinestoneMessageType.RhinestoneBundle:
            this.eventEmitter.emit(
              RHINESTONE_EVENTS.MESSAGE_BUNDLE,
              message as RhinestoneBundleMessage,
            )
            break
          case RhinestoneMessageType.RelayerActionV1:
            this.eventEmitter.emit(
              RHINESTONE_EVENTS.RELAYER_ACTION_V1,
              message as RhinestoneRelayerActionV1,
            )
            break
          default:
            this.logger.warn(`Unknown message type: ${(message as any).type}`)
        }
      } catch (error) {
        this.logger.error(`Failed to parse message: ${error}`)
        this.eventEmitter.emit(RHINESTONE_EVENTS.ERROR, error as Error)
      }
    })

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}`)
      this.stopPingInterval()
      this.eventEmitter.emit(RHINESTONE_EVENTS.DISCONNECTED, { code, reason: reason.toString() })

      if (!this.isIntentionallyClosed && this.config.reconnect) {
        this.attemptReconnect()
      }
    })

    this.ws.on('error', (error: Error) => {
      this.logger.error(`WebSocket error: ${error.message}`)
      this.eventEmitter.emit(RHINESTONE_EVENTS.ERROR, error)
    })

    this.ws.on('ping', (data: Buffer) => {
      this.logger.debug('Received ping from server')
      this.eventEmitter.emit(RHINESTONE_EVENTS.PING, data)
    })

    this.ws.on('pong', (data: Buffer) => {
      this.logger.debug('Received pong from server')
      this.eventEmitter.emit(RHINESTONE_EVENTS.PONG, data)
    })
  }

  /**
   * Parse incoming WebSocket message data
   * @param data Raw WebSocket data
   * @returns Parsed Rhinestone message
   * @throws {Error} If message format is invalid
   */
  private parseMessage(data: WebSocket.Data): RhinestoneMessage {
    let parsedData: any

    if (data instanceof Buffer) {
      parsedData = JSON.parse(data.toString())
    } else if (typeof data === 'string') {
      parsedData = JSON.parse(data)
    } else {
      throw new Error('Unsupported message format')
    }

    // Validate message type
    if (!parsedData.type || !Object.values(RhinestoneMessageType).includes(parsedData.type)) {
      throw new Error(`Invalid or missing message type: ${parsedData.type}`)
    }

    return parsedData
  }

  /**
   * Start periodic ping messages to keep connection alive
   */
  private startPingInterval() {
    if (!this.config.pingInterval) return

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
        this.logger.debug('Sent ping to server')
      }
    }, this.config.pingInterval)
  }

  /**
   * Stop the ping interval timer
   */
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server after disconnection
   */
  private attemptReconnect() {
    if (
      !this.config.maxReconnectAttempts ||
      this.reconnectAttempts >= this.config.maxReconnectAttempts
    ) {
      this.logger.error('Max reconnect attempts reached')
      this.eventEmitter.emit(RHINESTONE_EVENTS.RECONNECT_FAILED)
      return
    }

    this.reconnectAttempts++
    const delay = this.config.reconnectInterval || 5000

    this.logger.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts}) in ${delay}ms`,
    )

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error(`Reconnect attempt failed: ${error}`)
      })
    }, delay)
  }
}
