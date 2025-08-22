import { GaslessIntentRequestDTO } from '@eco-solver/quote/dto/gasless-intent-request.dto';
import { Hex } from 'viem';
import { QuoteRewardDataDTO } from '@eco-solver/quote/dto/quote.reward.data.dto';
export interface GaslessIntentFactoryOptions extends Partial<GaslessIntentRequestDTO> {
    usePermit?: boolean;
    isBatchPermit2?: boolean;
    token?: `0x${string}`;
}
export declare class IntentTestUtils {
    private permitTestUtils;
    private quoteTestUtils;
    constructor();
    createRewardDTO(overrides?: Partial<QuoteRewardDataDTO> & {
        token?: Hex;
    }): QuoteRewardDataDTO;
    createGaslessIntentRequestDTO(overrides?: GaslessIntentFactoryOptions): GaslessIntentRequestDTO;
}
