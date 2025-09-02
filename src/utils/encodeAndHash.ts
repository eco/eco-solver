import { Address, VmType } from "@/eco-configs/eco-config.types"
import { Hex } from "viem"

export type RouteType<TVM extends VmType = VmType> = {
    vm: TVM
    salt: Hex
    deadline: bigint
    portal: Address<TVM>
    tokens: readonly {
        token: Address<TVM>
        amount: bigint
    }[]
    calls: readonly {
        target: Address<TVM>
        data: Hex
        value: bigint
    }[]
}

export type RewardType<TVM extends VmType = VmType> = {
    vm: TVM
    creator: Address<TVM>
    prover: Address<TVM>
    deadline: bigint
    nativeAmount: bigint
    tokens: readonly {
    token: Address<TVM>
    amount: bigint
    }[]
}

export type IntentType<SourceVM extends VmType = VmType, TargetVM extends VmType = VmType> = {
    source: bigint
    destination: bigint
    route: RouteType<SourceVM>
    reward: RewardType<TargetVM>
}
  