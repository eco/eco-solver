import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { EcoResponse } from '@/common/eco-response';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoLogger } from '@/common/logging/eco-logger';
import { EcoError } from '@/errors/eco-error';
import {
  GaslessInitiationIntent,
  GaslessInitiationIntentDocument,
} from '@/modules/api/gasless-intents/schemas/gasless-initiation-intent.schema';

@Injectable()
export class GaslessInitiationIntentRepository {
  private logger = new EcoLogger(GaslessInitiationIntentRepository.name);

  constructor(
    @InjectModel(GaslessInitiationIntent.name)
    private readonly model: Model<GaslessInitiationIntentDocument>,
  ) {}

  async getIntentForGroupID(
    intentGroupID: string,
    projection: object = {},
  ): Promise<EcoResponse<GaslessInitiationIntent>> {
    const intent = await this.queryIntent({ intentGroupID }, projection);

    if (!intent) {
      return { error: EcoError.IntentNotFound };
    }

    return { response: intent };
  }

  async getIntentForTransactionHash(
    txHash: string,
    projection: object = {},
  ): Promise<EcoResponse<GaslessInitiationIntent>> {
    const intent = await this.queryIntent({ destinationChainTxHash: txHash }, projection);

    if (!intent) {
      return { error: EcoError.IntentNotFound };
    }

    return { response: intent };
  }

  async exists(query: object): Promise<boolean> {
    const res = await this.model.exists(query);
    return Boolean(res);
  }

  async queryIntent(query: object, projection: any = {}): Promise<GaslessInitiationIntent | null> {
    return this.model.findOne(query, projection).lean();
  }

  async queryIntents(query: object, projection: any = {}): Promise<GaslessInitiationIntent[]> {
    return this.model.find(query, projection).lean();
  }

  async addIntent(data: GaslessInitiationIntent): Promise<EcoResponse<boolean>> {
    try {
      const createdOK = await this.createWithDupCheck(data, 'intentGroupID');
      return { response: createdOK };
    } catch (ex) {
      EcoError.logErrorWithStack(ex, `addIntent: exception`, this.logger, {
        intentGroupID: data.intentGroupID,
      });

      return { error: EcoError.GaslessIntentInitiationError };
    }
  }

  private async createWithDupCheck(
    data: GaslessInitiationIntent,
    indexForDupCheck: string,
  ): Promise<boolean> {
    try {
      await this.create(data);
      return false;
    } catch (ex) {
      const isDuplicate = this.isDuplicateInsert(ex, indexForDupCheck);
      if (isDuplicate) {
        return true;
      }

      throw ex;
    }
  }

  private async create(data: GaslessInitiationIntent): Promise<GaslessInitiationIntent> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `create: GaslessInitiationIntent`,
        properties: {
          data,
        },
      }),
    );

    const newInstance = new this.model(data);
    await newInstance.save();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = newInstance.toObject({ versionKey: false });
    return rest as GaslessInitiationIntent;
  }

  private isDuplicateInsert(exception: any, indexForDupCheck?: string): boolean {
    const message = exception instanceof Error ? exception.message : String(exception);
    const duplicateErrorMessage =
      message && message.includes('duplicate key') ? message : undefined;

    if (!duplicateErrorMessage) {
      return false;
    }

    if (!indexForDupCheck) {
      return true;
    }

    return message.includes(`index: ${indexForDupCheck}`) ? true : false;
  }

  async updateIntent(
    intentGroupID: string,
    updates: object,
    options?: object,
  ): Promise<GaslessInitiationIntent | null> {
    const query = { intentGroupID };
    return this.update(query, updates, options);
  }

  async update(
    query: object,
    updates: object,
    options?: object,
  ): Promise<GaslessInitiationIntent | null> {
    const updateOptions = options || { upsert: false, new: true };
    const updatesData = this.updatesHasOp(updates) ? updates : { $set: updates };

    const updateResponse = await this.model.findOneAndUpdate(query, updatesData, updateOptions);

    if (updateResponse) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = updateResponse.toObject({ versionKey: false });
      return rest as GaslessInitiationIntent;
    }

    return null;
  }

  async deleteIntents(query: object): Promise<any> {
    return this.model.deleteMany(query);
  }

  private updatesHasOp(updates: object): boolean {
    return Object.keys(updates).some((key) => key.startsWith('$'));
  }
}
