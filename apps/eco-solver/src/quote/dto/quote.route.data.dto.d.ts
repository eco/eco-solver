import { CallDataInterface } from '@eco-solver/contracts';
import { QuoteRewardTokensDTO } from '@eco-solver/quote/dto/quote.reward.data.dto';
import { RouteType } from '@eco-foundation/routes-ts';
import { Hex } from 'viem';
/**
 * The DTO for the route data that the sender wants to make.
 * Similar to {@link RouteType} except that it does not contain the salt field.
 * @param source denotes the source chain id of the route
 * @param destination denotes the destination chain id of the route
 * @param inbox denotes the inbox address
 * @param calls denotes the array of {@link QuoteCallDataDTO} that the sender wants to make
 */
export declare class QuoteRouteDataDTO implements QuoteRouteDataInterface {
    source: bigint;
    destination: bigint;
    inbox: Hex;
    tokens: QuoteRewardTokensDTO[];
    calls: QuoteCallDataDTO[];
}
/**
 * The DTO for the call data that the sender wants to make.
 * @param target denotes the target address of the call
 * @param data denotes the data of the call
 * @param value denotes the native token value of the call
 */
export declare class QuoteCallDataDTO implements CallDataInterface {
    target: Hex;
    data: Hex;
    value: bigint;
}
export type QuoteRouteDataInterface = Omit<RouteType, 'salt'>;
