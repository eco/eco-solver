import { GaslessIntentDataDTO } from '@eco-solver/quote/dto/gasless-intent-data.dto';
import { Hex } from 'viem';
import { QuoteRewardDataDTO } from '@eco-solver/quote/dto/quote.reward.data.dto';
import { QuoteRouteDataDTO } from '@eco-solver/quote/dto/quote.route.data.dto';
export declare class GaslessIntentRequestDTO {
    quoteID: string;
    dAppID: string;
    salt: Hex;
    route: QuoteRouteDataDTO;
    reward: QuoteRewardDataDTO;
    gaslessIntentData: GaslessIntentDataDTO;
    getSourceChainID?(): number;
    getFunder?(): Hex;
    getPermitContractAddress?(): Hex;
    static fromJSON(json: any): GaslessIntentRequestDTO;
}
