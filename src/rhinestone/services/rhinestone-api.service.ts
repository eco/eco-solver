import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Hash } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RhinestoneConfig } from '@/eco-configs/eco-config.types'

export interface FillPreconfirmationEvent {
  type: 'FillPreconfirmation'
  chainId: number
  txHash: Hash
}

export interface BundleEventsResponse {
  bundleId: string
  events: Array<{
    type: string
    timestamp: number
    data: any
  }>
}

@Injectable()
export class RhinestoneApiService implements OnModuleInit {
  private readonly logger = new Logger(RhinestoneApiService.name)
  private config: RhinestoneConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {}

  onModuleInit() {
    this.config = this.ecoConfigService.getRhinestone()
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
    const url = `${this.config.orchestratorUrl}/bundles/${bundleId}/events`

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Posting bundle event',
        properties: {
          bundleId,
          eventType: event.type,
          chainId: event.chainId,
          txHash: event.txHash,
        },
      }),
    )

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.orchestratorApiKey,
        },
        body: JSON.stringify(event),
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
          message: 'Bundle event posted successfully',
          properties: {
            bundleId,
            eventsCount: data.events?.length || 0,
          },
        }),
      )

      return data
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to post bundle event',
          properties: {
            bundleId,
            error: error.message,
          },
        }),
      )
      throw error
    }
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
}
