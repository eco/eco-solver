import { OnModuleInit } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { Queue } from 'bullmq';
import { IntentSourceModel } from './schemas/intent-source.schema';
import { Model } from 'mongoose';
import { Hex } from 'viem';
import { ValidSmartWalletService } from '../solver/filters/valid-smart-wallet.service';
import { IntentCreatedLog } from '../contracts';
import { FlagService } from '../flags/flags.service';
import { Serialize } from '@eco-solver/common/utils/serialize';
import { RouteType } from '@eco-foundation/routes-ts';
import { QuoteRewardDataModel } from '@eco-solver/quote/schemas/quote-reward.schema';
import { EcoResponse } from '@eco-solver/common/eco-response';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * This service is responsible for creating a new intent record in the database. It is
 * triggered when a new intent is created recieved in {@link WatchIntentService}.
 * It validates that the record doesn't exist yet, and that its creator is a valid BEND wallet
 */
export declare class CreateIntentService implements OnModuleInit {
    private readonly intentQueue;
    private intentModel;
    private readonly validSmartWalletService;
    private readonly flagService;
    private readonly ecoConfigService;
    private readonly ecoAnalytics;
    private logger;
    private intentJobConfig;
    constructor(intentQueue: Queue, intentModel: Model<IntentSourceModel>, validSmartWalletService: ValidSmartWalletService, flagService: FlagService, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    onModuleInit(): void;
    /**
     * Decodes the intent log, validates the creator is a valid BEND wallet, and creates a new record in the database
     * if one doesn't yet exist. Finally it enqueue the intent for validation
     *
     * @param serializedIntentWs the serialized intent created log
     * @returns
     */
    createIntent(serializedIntentWs: Serialize<IntentCreatedLog>): Promise<void>;
    createIntentFromIntentInitiation(quoteID: string, funder: Hex, route: RouteType, reward: QuoteRewardDataModel): Promise<void>;
    /**
     * Fetch an intent from the db
     * @param query for fetching the intent
     * @returns the intent or an error
     */
    getIntentForHash(hash: string): Promise<EcoResponse<IntentSourceModel>>;
    /**
     * Fetch an intent from the db
     * @param query for fetching the intent
     * @returns the intent or an error
     */
    fetchIntent(query: object): Promise<EcoResponse<IntentSourceModel>>;
}
