import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  IntentFulfilledEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { Intent as IntentInterface, IntentStatus } from '@/common/interfaces/intent.interface';
import { Intent, IntentDocument } from '@/modules/intents/schemas/intent.schema';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';

@Injectable()
export class IntentsService {
  constructor(@InjectModel(Intent.name) private intentModel: Model<IntentDocument>) {}

  /**
   * Atomically creates an intent if it doesn't exist, or updates lastSeen if it does
   * @param intentData The intent data to create
   * @returns Object containing the intent and whether it was newly created
   */
  async createIfNotExists(intentData: IntentInterface): Promise<{
    intent: Intent;
    isNew: boolean;
  }> {
    const schemaData = IntentConverter.toSchema(intentData);

    const result = await this.intentModel.findOneAndUpdate(
      { intentHash: intentData.intentHash },
      {
        $setOnInsert: {
          ...schemaData,
          firstSeenAt: new Date(),
        },
        $set: {
          lastSeen: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        includeResultMetadata: true,
      },
    );

    return {
      intent: result.value!,
      isNew: !result.lastErrorObject?.updatedExisting,
    };
  }

  async findById(intentHash: string): Promise<Intent | null> {
    return this.intentModel.findOne({ intentHash }).exec();
  }

  async updateStatus(
    intentHash: string,
    status: IntentStatus,
    additionalData?: Partial<Intent>,
  ): Promise<Intent | null> {
    return this.intentModel
      .findOneAndUpdate({ intentHash }, { status, ...additionalData }, { new: true })
      .exec();
  }

  /**
   * Update intent with IntentFulfilled event data
   */
  async updateFulfilledEvent(eventData: IntentFulfilledEvent): Promise<Intent | null> {
    return this.intentModel
      .findOneAndUpdate(
        { intentHash: eventData.intentHash },
        {
          fulfilledEvent: {
            claimant: eventData.claimant,
            txHash: eventData.transactionHash,
            blockNumber: eventData.blockNumber?.toString(),
            timestamp: eventData.timestamp,
            chainId: eventData.chainId.toString(),
          },
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Update intent with IntentProven event data
   */
  async updateProvenEvent(eventData: IntentProvenEvent): Promise<Intent | null> {
    return this.intentModel
      .findOneAndUpdate(
        { intentHash: eventData.intentHash },
        {
          provenEvent: {
            claimant: eventData.claimant,
            transactionHash: eventData.transactionHash,
            blockNumber: eventData.blockNumber?.toString(),
            timestamp: eventData.timestamp,
            chainId: eventData.chainId.toString(),
          },
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Update intent with IntentWithdrawn event data
   */
  async updateWithdrawnEvent(eventData: IntentWithdrawnEvent): Promise<Intent | null> {
    return this.intentModel
      .findOneAndUpdate(
        { intentHash: eventData.intentHash },
        {
          withdrawnEvent: {
            claimant: eventData.claimant,
            txHash: eventData.transactionHash,
            blockNumber: eventData.blockNumber?.toString(),
            timestamp: eventData.timestamp,
            chainId: eventData.chainId.toString(),
          },
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Find intents that have been proven but not yet withdrawn
   */
  async findProvenNotWithdrawn(sourceChainId?: bigint): Promise<Intent[]> {
    const query: any = {
      provenEvent: { $exists: true },
      withdrawnEvent: { $exists: false },
    };

    if (sourceChainId) {
      query['route.source'] = sourceChainId.toString();
    }

    return this.intentModel.find(query).exec();
  }
}
