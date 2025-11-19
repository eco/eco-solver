import { Injectable } from '@nestjs/common';

import {
  IntentFulfilledEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { Intent as IntentInterface, IntentStatus } from '@/common/interfaces/intent.interface';
import { IntentRepository } from '@/modules/intents/repositories/intent.repository';
import { Intent } from '@/modules/intents/schemas/intent.schema';

@Injectable()
export class IntentsService {
  constructor(private readonly intentRepository: IntentRepository) {}

  /**
   * Atomically creates an intent if it doesn't exist, or updates lastSeen if it does
   * @param intentData The intent data to create
   * @returns Object containing the intent and whether it was newly created
   */
  async createIfNotExists(intentData: IntentInterface): Promise<{
    intent: Intent;
    isNew: boolean;
  }> {
    return this.intentRepository.createIfNotExists(intentData);
  }

  async findByID(intentHash: string): Promise<Intent | null> {
    return this.intentRepository.findByID(intentHash);
  }

  async updateStatus(
    intentHash: string,
    status: IntentStatus,
    additionalData?: Partial<Intent>,
  ): Promise<Intent | null> {
    return this.intentRepository.updateStatus(intentHash, status, additionalData);
  }

  /**
   * Update intent with IntentFulfilled event data
   */
  async updateFulfilledEvent(eventData: IntentFulfilledEvent): Promise<Intent | null> {
    return this.intentRepository.updateFulfilledEvent(eventData);
  }

  /**
   * Update intent with IntentProven event data
   */
  async updateProvenEvent(eventData: IntentProvenEvent): Promise<Intent | null> {
    return this.intentRepository.updateProvenEvent(eventData);
  }

  /**
   * Update intent with IntentWithdrawn event data
   */
  async updateWithdrawnEvent(eventData: IntentWithdrawnEvent): Promise<Intent | null> {
    return this.intentRepository.updateWithdrawnEvent(eventData);
  }

  /**
   * Find intents that have been proven but not yet withdrawn
   */
  async findProvenNotWithdrawn(sourceChainId?: bigint): Promise<Intent[]> {
    return this.intentRepository.findProvenNotWithdrawn(sourceChainId);
  }
}
