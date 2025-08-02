import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { Intent, IntentDocument } from '@/modules/intents/schemas/intent.schema';

@Injectable()
export class IntentsService {
  constructor(@InjectModel(Intent.name) private intentModel: Model<IntentDocument>) {}

  async create(intentData: Partial<Intent>): Promise<Intent> {
    const intent = new this.intentModel(intentData);
    return intent.save();
  }

  async findById(intentId: string): Promise<Intent | null> {
    return this.intentModel.findOne({ intentId }).exec();
  }

  async findByStatus(status: IntentStatus): Promise<Intent[]> {
    return this.intentModel.find({ status }).exec();
  }

  async updateStatus(
    intentId: string,
    status: IntentStatus,
    additionalData?: Partial<Intent>,
  ): Promise<Intent | null> {
    return this.intentModel
      .findOneAndUpdate({ intentId }, { status, ...additionalData }, { new: true })
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
