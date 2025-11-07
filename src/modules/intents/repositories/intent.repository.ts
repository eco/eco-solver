import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { EcoResponse } from '@/common/eco-response';
import {
  IntentFulfilledEvent,
  IntentFundedEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { Intent as IntentInterface, IntentStatus } from '@/common/interfaces/intent.interface';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoLogger } from '@/common/logging/eco-logger';
import { EcoError } from '@/errors/eco-error';
import { Intent, IntentDocument } from '@/modules/intents/schemas/intent.schema';
import { IntentData } from '@/modules/intents/schemas/intent-data.schema';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';

export interface CreateIntentResponse {
  intent: Intent;
  isNew: boolean;
}

@Injectable()
export class IntentRepository {
  private logger = new EcoLogger(IntentRepository.name);

  constructor(@InjectModel(Intent.name) private model: Model<IntentDocument>) {}

  /**
   * Atomically creates an intent if it doesn't exist, or updates lastSeen if it does
   * @param intentData The intent data to create
   * @returns Object containing the intent and whether it was newly created
   */
  async createIfNotExists(intentData: IntentInterface): Promise<CreateIntentResponse> {
    return this._createIfNotExists(IntentConverter.toSchema(intentData) as Intent);
  }

  async createIntentFromGaslessIntentInitiation(
    intentHash: string,
    intentGroupID: string,
    intentData: IntentData,
  ): Promise<EcoResponse<CreateIntentResponse>> {
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `createIntentFromIntentInitiation`,
          properties: {
            intentGroupID,
            intent: intentData,
          },
        }),
      );

      const intent: Intent = {
        intentHash,
        intentGroupID,
        reward: {
          creator: intentData.reward.creator,
          prover: intentData.reward.prover,
          deadline: intentData.reward.deadline.toString(),
          nativeAmount: intentData.reward.nativeAmount.toString(),
          tokens: intentData.reward.tokens.map((token) => ({
            amount: token.amount.toString(),
            token: token.token,
          })),
        },
        route: {
          salt: intentData.route.salt,
          portal: intentData.route.portal,
          destination: intentData.destination.toString(),
          source: intentData.sourceChainId.toString(),
          deadline: intentData.route.deadline,
          nativeAmount: intentData.route.nativeAmount,
          calls: intentData.route.calls.map((call) => ({
            data: call.data,
            target: call.target,
            value: call.value.toString(),
          })),
          tokens: intentData.route.tokens.map((token) => ({
            amount: token.amount.toString(),
            token: token.token,
          })),
        },
        status: IntentStatus.FUNDED,
        // firstSeenAt: new Date(),
        // lastSeen: new Date(),
      } as Intent;

      const createResponse = await this._createIfNotExists(intent);
      return { response: createResponse };
    } catch (ex: any) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in createIntentFromIntentInitiation`,
          properties: {
            intentGroupID,
            error: ex.message,
          },
        }),
        ex.stack,
      );

      return { error: EcoError.IntentCreationError };
    }
  }

  private async _createIfNotExists(intent: Intent): Promise<{
    intent: Intent;
    isNew: boolean;
  }> {
    const result = await this.model.findOneAndUpdate(
      { intentHash: intent.intentHash },
      {
        $setOnInsert: {
          ...intent,
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

  async findByHash(intentHash: string, projection: any = {}): Promise<Intent | null> {
    return this.queryIntent({ intentHash }, projection);
  }

  async updateStatus(
    intentHash: string,
    status: IntentStatus,
    additionalData?: Partial<Intent>,
  ): Promise<Intent | null> {
    return this.model
      .findOneAndUpdate({ intentHash }, { status, ...additionalData }, { new: true })
      .exec();
  }

  /**
   * Update intent with IntentFunded event data
   */
  async updateFundedEvent(eventData: IntentFundedEvent): Promise<Intent | null> {
    return this.model
      .findOneAndUpdate(
        { intentHash: eventData.intentHash },
        {
          status: IntentStatus.FUNDED,
          fundedEvent: {
            funder: eventData.funder,
            complete: eventData.complete,
            txHash: eventData.transactionHash,
            blockNumber: eventData.blockNumber?.toString(),
            timestamp: eventData.timestamp,
            chainId: eventData.chainId.toString(),
          },
          lastProcessedAt: new Date(),
        },
        { new: true },
      )
      .exec();
  }

  /**
   * Update intent with IntentFulfilled event data
   */
  async updateFulfilledEvent(eventData: IntentFulfilledEvent): Promise<Intent | null> {
    return this.model
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
    return this.model
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
    return this.model
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

    return this.model.find(query).exec();
  }

  async getIntentsForGroupID(intentGroupID: string, projection: any = {}): Promise<Intent[]> {
    return this.queryIntents({ intentGroupID }, projection);
  }

  async getIntentsByHashes(hashes: string[], projection: any = {}): Promise<Intent[]> {
    if (hashes.length === 0) {
      return [];
    }
    return this.queryIntents({ intentHash: { $in: hashes } }, projection);
  }

  async exists(query: any): Promise<boolean> {
    const res = await this.model.exists(query);
    return Boolean(res);
  }

  async queryIntent(query: any, projection: any = {}): Promise<Intent | null> {
    return this.model.findOne(query, projection).lean();
  }

  async queryIntents(query: any, projection: any = {}): Promise<Intent[]> {
    return this.model.find(query, projection).lean();
  }

  async update(query: any, updates: any, options?: any): Promise<Intent | null> {
    const updateOptions = options || { upsert: false, new: true };
    const updatesData = this.updatesHasOp(updates) ? updates : { $set: updates };

    const updateResponse = await this.model
      .findOneAndUpdate(query, updatesData, updateOptions)
      .lean(); // ✅ Always return plain object

    if (updateResponse) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = updateResponse;
      return rest as Intent;
    }

    return null;
  }

  private updatesHasOp(updates: object): boolean {
    return Object.keys(updates).some((key) => key.startsWith('$'));
  }
}
