/**
 * The DTO for the reward tokens that the sender has and wants to send.
 * @param token denotes the token address
 * @param amount denotes the amount of tokens the caller wants to send
 * @param balance denotes the amount of tokens the caller can send
 */
export type RewardTokensType = Prettify<RewardType['tokens'][number]>

/**
 * The type for the route calls that the sender wants to make.
 * @param target denotes the target address of the call
 * @param data denotes the data of the call
 * @param value denotes the native token value of the call
 */
export type CallDataType = RouteType['calls'][number]
