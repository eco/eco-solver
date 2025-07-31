import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Hash } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RhinestoneConfigService } from '@/rhinestone/services/rhinestone-config.service'
import { RhinestoneConfig } from '@/eco-configs/eco-config.types'

/**
 * Fill preconfirmation event to be posted to the Rhinestone orchestrator
 */
export interface FillPreconfirmationEvent {
  type: 'FillPreconfirmation'
  chainId: number
  txHash: Hash
}

/**
 * Response from the bundle events API endpoint
 */
export interface BundleEventsResponse {
  bundleId: string
  events: Array<{
    type: string
    timestamp: number
    data: any
  }>
}

/**
 * Service for interacting with the Rhinestone orchestrator API.
 * Handles posting fill preconfirmations and retrieving bundle events.
 */
@Injectable()
export class RhinestoneApiService implements OnModuleInit {
  private readonly logger = new Logger(RhinestoneApiService.name)
  private config: RhinestoneConfig['api']

  constructor(private readonly rhinestoneConfigService: RhinestoneConfigService) {}

  /**
   * Initialize the service by loading configuration
   */
  onModuleInit() {
    this.config = this.rhinestoneConfigService.getAPI()
  }

  /**
   * Post a fill preconfirmation event for a bundle
   * @param bundleId The bundle ID
   * @param event The fill preconfirmation event
   * @returns The response from the API
   */
  async postBundleEvent(
    bundleId: string,
    event: FillPreconfirmationEvent,
  ): Promise<BundleEventsResponse> {
    return this.makeApiRequest<BundleEventsResponse>(`/bundles/${bundleId}/events`, {
      method: 'POST',
      body: event,
      logContext: {
        bundleId,
        eventType: event.type,
        chainId: event.chainId,
        txHash: event.txHash,
      },
    })
  }

  /**
   * Post a fill preconfirmation for a transaction
   * @param bundleId The bundle ID
   * @param chainId The chain ID where the transaction was executed
   * @param txHash The transaction hash
   * @returns The updated bundle events
   */
  async postFillPreconfirmation(
    bundleId: string,
    chainId: number,
    txHash: Hash,
  ): Promise<BundleEventsResponse> {
    return this.postBundleEvent(bundleId, {
      type: 'FillPreconfirmation',
      chainId,
      txHash,
    })
  }

  /**
   * Make an API request to the Rhinestone orchestrator
   * @param endpoint The API endpoint (relative to orchestratorUrl)
   * @param options Request options
   * @returns The response data
   */
  private async makeApiRequest<T = any>(
    endpoint: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: any
      logContext?: Record<string, any>
    },
  ): Promise<T> {
    const url = `${this.config.orchestratorUrl}${endpoint}`
    const { method, body, logContext = {} } = options

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `Making ${method} request to Rhinestone API`,
        properties: {
          url,
          method,
          ...logContext,
        },
      }),
    )

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.orchestratorApiKey,
        },
        ...(body && { body: JSON.stringify(body) }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
        )
      }

      const data = await response.json()

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `${method} request completed successfully`,
          properties: {
            url,
            ...logContext,
          },
        }),
      )

      return data
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to make ${method} request`,
          properties: {
            url,
            error: error.message,
            ...logContext,
          },
        }),
      )
      throw error
    }
  }
}
