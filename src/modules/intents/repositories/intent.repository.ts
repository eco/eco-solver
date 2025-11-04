import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  IntentFulfilledEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { Intent as IntentInterface, IntentStatus } from '@/common/interfaces/intent.interface';
import { EcoLogger } from '@/common/logging/eco-logger';
import { Intent, IntentDocument } from '@/modules/intents/schemas/intent.schema';
import { IntentConverter } from '@/modules/intents/utils/intent-converter';

@Injectable()
export class IntentRepository {
  private logger = new EcoLogger(IntentRepository.name);

  constructor(@InjectModel(Intent.name) private model: Model<IntentDocument>) {}

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

    const result = await this.model.findOneAndUpdate(
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

  async findByID(intentHash: string): Promise<Intent | null> {
    return this.model.findOne({ intentHash }).exec();
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

  // async create(data: any): Promise<Intent> {
  //   return this.model.create(data);
  // }

  async getIntent(hash: string, projection: any = {}): Promise<Intent | null> {
    return this.queryIntent({ 'intent.hash': hash }, projection);
  }

  async getIntentsForGroupID(intentGroupID: string, projection: any = {}): Promise<Intent[]> {
    return this.queryIntents({ 'intent.intentGroupID': intentGroupID }, projection);
  }

  async getIntentsByHashes(hashes: string[], projection: any = {}): Promise<Intent[]> {
    if (hashes.length === 0) {
      return [];
    }
    return this.queryIntents({ 'intent.hash': { $in: hashes } }, projection);
  }

  // async createIntentFromIntentInitiation(
  //   intentGroupID: string,
  //   quoteID: string,
  //   funder: Hex,
  //   intentHash: Hex,
  //   route: RouteType,
  //   reward: QuoteRewardDataType,
  // ) {
  //   try {
  //     const {
  //       salt,
  //       source,
  //       destination,
  //       inbox,
  //       tokens: routeTokens,
  //       calls,
  //       deadline: routeDeadline,
  //     } = route as RouteType & { deadline: bigint }; // TODO: Must be update to use V2 contracts
  //     const { creator, prover, deadline, nativeValue } = reward;
  //     const rewardTokens = reward.tokens as RewardTokensInterface[];

  //     this.logger.debug(
  //       EcoLogMessage.fromDefault({
  //         message: `createIntentFromIntentInitiation`,
  //         properties: {
  //           intentHash,
  //         },
  //       }),
  //     );

  //     const intent = new IntentDataModel({
  //       intentGroupID,
  //       quoteID,
  //       hash: intentHash,
  //       salt,
  //       source,
  //       destination,
  //       inbox,
  //       routeTokens: routeTokens as RewardTokensInterface[],
  //       calls: calls as CallDataInterface[],
  //       creator,
  //       prover,
  //       deadline,
  //       routeDeadline: routeDeadline || deadline,
  //       nativeValue,
  //       rewardTokens,
  //       logIndex: 0,
  //       funder,
  //     });

  //     await this.model.create({
  //       // event: null,
  //       intent,
  //       receipt: null,
  //       status: 'PENDING',
  //     });
  //   } catch (ex: any) {
  //     this.logger.error(
  //       EcoLogMessage.fromDefault({
  //         message: `Error in createIntentFromIntentInitiation`,
  //         properties: {
  //           quoteID,
  //           error: ex.message,
  //         },
  //       }),
  //       ex.stack,
  //     );
  //   }
  // }

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
