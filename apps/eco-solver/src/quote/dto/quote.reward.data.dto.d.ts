import { Hex } from 'viem';
import { RewardTokensInterface } from '@eco-solver/contracts';
import { RewardType } from '@eco-foundation/routes-ts';
/**
 * The DTO for the intent reward data. Similar to {@link RewardType} except
 * that it does not contain the creator and tokens fields. Also has a modified
 * tokens field that is an array of {@link QuoteRewardTokensDTO} which include the
 * sender's willing token balance to use for the reward.
 * @param prover denotes the prover address
 * @param deadline denotes the deadline for the reward
 * @param nativeValue denotes the native token value of the reward
 * @param tokens denotes the array of {@link QuoteRewardTokensDTO} that the sender has
 */
export declare class QuoteRewardDataDTO implements QuoteRewardDataType {
    creator: Hex;
    prover: Hex;
    deadline: bigint;
    nativeValue: bigint;
    tokens: QuoteRewardTokensDTO[];
    hasToken?(token: Hex): boolean;
    static fromJSON(json: any): QuoteRewardDataDTO;
}
/**
 * The DTO for the reward tokens that the sender has and wants to send.
 * @param token denotes the token address
 * @param amount denotes the amount of tokens the caller wants to send
 * @param balance denotes the amount of tokens the caller can send
 */
export declare class QuoteRewardTokensDTO implements RewardTokensInterface {
    token: Hex;
    amount: bigint;
}
type QuoteRewardType = RewardType;
export type QuoteRewardDataType = QuoteRewardType;
export {};
