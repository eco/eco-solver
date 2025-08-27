import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { Intent as IntentInterface, IntentStatus } from '@/common/interfaces/intent.interface';
import { Intent, IntentDocument } from '@/modules/intents/schemas/intent.schema';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';

@Injectable()
export class IntentsService {
  constructor(@InjectModel(Intent.name) private intentModel: Model<IntentDocument>) {}

  async create(intentData: IntentInterface): Promise<Intent> {
    const schemaData = IntentConverter.toSchema(intentData);
    const intent = new this.intentModel(schemaData);
    return intent.save();
  }

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

  async findByStatus(status: IntentStatus): Promise<Intent[]> {
    return this.intentModel.find({ status }).exec();
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

  async findPendingIntents(): Promise<Intent[]> {
    return this.intentModel
      .find({
        status: { $in: [IntentStatus.PENDING, IntentStatus.VALIDATING] },
        deadline: { $gt: Math.floor(Date.now() / 1000) },
      })
      .exec();
  }
}
