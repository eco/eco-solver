import { IntentViewType, RewardViemType, RouteViemType } from '@/contracts/intent-source'
import { extractAbiStruct } from '@/contracts/utils'
import { IntentSourceAbi, IntentVaultBytecode } from '@eco-foundation/routes-ts'
import { encodeAbiParameters, encodePacked, Hex, keccak256, getContractAddress, Abi } from 'viem'

export type ExtractAbiFunctions<abi extends Abi> = Extract<abi[number], { type: 'function' }>

type GetIntentHashFunction = Extract<
  ExtractAbiFunctions<typeof IntentSourceAbi>,
  { name: 'getIntentHash' }
>['inputs'][number]['components'][number]

type Reward = Extract<GetIntentHashFunction, { name: 'reward' }>['components']
type Route = Extract<GetIntentHashFunction, { name: 'route' }>['components']

const RouteStruct = extractAbiStruct<typeof IntentSourceAbi, Route>(IntentSourceAbi, 'route')
const RewardStruct = extractAbiStruct<typeof IntentSourceAbi, Reward>(IntentSourceAbi, 'reward')

export function encodeRoute(route: RouteViemType) {
  return encodeAbiParameters([{ type: 'tuple', components: RouteStruct }], [route])
}

export function encodeReward(reward: RewardViemType) {
  return encodeAbiParameters([{ type: 'tuple', components: RewardStruct }], [reward])
}

export function encodeIntent(intent: IntentViewType) {
  return encodePacked(
    ['bytes32', 'bytes32'],
    [encodeRoute(intent.route), encodeReward(intent.reward)],
  )
}

export function hashIntent(intent: IntentViewType): {
  routeHash: Hex
  rewardHash: Hex
  intentHash: Hex
} {
  const routeHash = keccak256(encodeRoute(intent.route))
  const rewardHash = keccak256(encodeReward(intent.reward))

  const intentHash = keccak256(encodePacked(['bytes32', 'bytes32'], [routeHash, rewardHash]))

  return {
    routeHash,
    rewardHash,
    intentHash,
  }
}

export function intentVaultAddress(intentSourceAddress: Hex, intent: IntentViewType): Hex {
  const { routeHash } = hashIntent(intent)

  return getContractAddress({
    opcode: 'CREATE2',
    from: intentSourceAddress,
    salt: routeHash,
    bytecode: IntentVaultBytecode,
  })
}
