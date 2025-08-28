import { encodeAbiParameters, encodePacked, Hex, keccak256 } from "viem";
import { routeStructAbi, V2RewardType, V2RouteType } from "@/contracts";
import { hashReward } from "@eco-foundation/routes-ts";

export function encodeRoute(route: V2RouteType) {
    const { source, destination, ...basicRoute } = route
    return encodeAbiParameters(
        [{ type: 'tuple', components: routeStructAbi }],
        [basicRoute],
    )
}

export function hashRoute(route: V2RouteType): Hex {
    return keccak256(encodeRoute(route))
}

export function encodeIntent(destination: bigint, route: V2RouteType, reward: V2RewardType): Hex {
    const routeHash = hashRoute(route)
    const rewardHash = hashReward({...reward, nativeValue: reward.nativeAmount})

    return encodePacked(['uint256', 'bytes32', 'bytes32'], [destination, routeHash, rewardHash])
}

export function hashIntent(destination: bigint, route: V2RouteType, reward: V2RewardType): {
    routeHash: Hex
    rewardHash: Hex
    intentHash: Hex
  } {
    const routeHash = hashRoute(route)
    const rewardHash = hashReward({...reward, nativeValue: reward.nativeAmount})
  
    const intentHash = keccak256(
      encodePacked(['uint256', 'bytes32', 'bytes32'], [destination, routeHash, rewardHash]),
    )
  
    return {
      routeHash,
      rewardHash,
      intentHash,
    }
  }