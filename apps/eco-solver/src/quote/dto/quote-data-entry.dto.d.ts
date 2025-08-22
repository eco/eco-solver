import { QuoteRewardTokensDTO } from '@eco-solver/quote/dto/quote.reward.data.dto';
import { QuoteCallDataDTO } from '@eco-solver/quote/dto/quote.route.data.dto';
export declare class QuoteDataEntryDTO {
    intentExecutionType: string;
    routeTokens: QuoteRewardTokensDTO[];
    routeCalls: QuoteCallDataDTO[];
    rewardTokens: QuoteRewardTokensDTO[];
    rewardNative: bigint;
    expiryTime: string;
    estimatedFulfillTimeSec: number;
    gasOverhead: number;
}
