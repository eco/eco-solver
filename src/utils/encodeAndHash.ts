import { Address, VmType } from "@/eco-configs/eco-config.types"
import { RewardStruct, RouteStruct } from "@/intent/abi"
import { BN } from "@coral-xyz/anchor"
import { decodeAbiParameters, encodeAbiParameters, encodePacked, Hex, keccak256 } from "viem"

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

export function encodeRoute(route: RouteType): Hex {
    switch (route.vm) {
    case VmType.EVM:
        return encodeAbiParameters(
        [{ type: 'tuple', components: RouteStruct }],
        [route],
        )
case VmType.SVM:
        // Use Anchor's BorshCoder for proper Solana serialization
        const { salt, deadline, portal, tokens, calls } = route;
        
        const saltBytes = Buffer.from(salt.slice(2), 'hex');
        const portalBytes = new PublicKey(portal).toBytes();
        
        const encoded = svmCoder.types.encode('Route', {
        salt: { 0: Array.from(saltBytes) }, // Bytes32 struct format
        deadline: new BN(deadline.toString()), // Convert BigInt to BN for u64
        portal: { 0: Array.from(portalBytes) }, // Bytes32 struct format
        tokens: tokens.map(({ token, amount }) => ({
            token: token instanceof PublicKey ? token : new PublicKey(token),
            amount: new BN(amount.toString()) // Convert BigInt to BN for u64
        })),
        calls: calls.map(({ target, data, value }) => ({
            target: { 0: Array.from(new PublicKey(target).toBytes()) }, // Bytes32 struct format
            data: Buffer.from(data.slice(2), 'hex'), // Keep as Buffer for bytes type
            value: new BN(value.toString()) // Convert BigInt to BN for u64
        }))
        });
        
        return `0x${encoded.toString('hex')}` as Hex;
    default:
        throw new Error(`Unsupported VM type: ${route.vm}`)
    }
}

export function hashRoute(route: RouteType): Hex {
    const encoded = encodeRoute(route)
    return keccak256(encoded)
}

export function encodeReward(reward: RewardType): Hex {
    switch (reward.vm) {
    case VmType.EVM:
        // Clean the reward object - remove MongoDB fields
        const cleanReward = {
            vm: reward.vm,
            creator: reward.creator,
            prover: reward.prover,
            deadline: reward.deadline,
            nativeValue: reward.nativeAmount || 0n,
            tokens: (reward.tokens || []).map(t => ({
                token: t.token,
                amount: t.amount
            }))
        };

        console.log("ENCREWARD: reward for EVM", cleanReward);

        return encodeAbiParameters(
            [{ type: 'tuple', components: RewardStruct }],
            [cleanReward as any],
        )
    case VmType.SVM:
        const { deadline, creator, prover, nativeAmount, tokens } = reward;
        
        const encoded = svmCoder.types.encode('Reward', {
        deadline: new BN(deadline.toString()),
        creator: new PublicKey(creator),
        prover: new PublicKey(prover),
        native_amount: new BN(nativeAmount.toString()),
        tokens: tokens.map(({ token, amount }) => ({
            token: new PublicKey(token),
            amount: new BN(amount.toString())
        }))
        });
        
        return `0x${encoded.toString('hex')}` as Hex;
    default:
        throw new Error(`Unsupported VM type: ${reward.vm}`)
    }
}

export function decodeRoute(vm: VmType, route: Hex): RouteType {
    switch (vm) {
    case VmType.EVM:
        console.log("SAQUON decodeRoute EVM", route);
        return {
        vm: VmType.EVM,
        ...decodeAbiParameters(
            [{ type: 'tuple', components: RouteStruct }],
            route, 
        )[0]
        } as RouteType
    case VmType.SVM:
        
        // Remove '0x' prefix if present
        const hexString = route.startsWith('0x') ? route.slice(2) : route;
        const routeBuffer = Buffer.from(hexString, 'hex');
        const decoded = svmCoder.types.decode('Route', routeBuffer);
        console.log("SAQUON decodeRoute SVM", decoded);
        
        // Convert Bytes32 struct format { 0: [...] } back to hex string
        const saltHex = `0x${Buffer.from(decoded.salt[0]).toString('hex')}` as Hex;
        
        return {
        vm: VmType.SVM,
        salt: saltHex,
        deadline: BigInt(decoded.deadline.toString()),
        portal: new PublicKey(decoded.portal[0]),
        tokens: decoded.tokens.map(({ token, amount }: any) => ({
            token: token.toString() as Hex,
            amount: BigInt(amount.toString())
        })),
        calls: decoded.calls.map(({ target, data, value }: any) => ({
            target: new PublicKey(target[0]),
            data: `0x${Buffer.from(data).toString('hex')}` as Hex,
            value: BigInt(value.toString())
        }))
        }
    }
}

export function hashReward(reward: RewardType): Hex {
    const encoded = encodeReward(reward)
    return keccak256(encoded)
}

export function encodeIntent(destination: bigint, route: RouteType, reward: RewardType): Hex {
    const routeHash = hashRoute(route)
    const rewardHash = hashReward(reward)
    return encodePacked(['uint64', 'bytes32', 'bytes32'], [destination, routeHash, rewardHash])
}

export function hashIntent(destination: bigint, route: RouteType, reward: RewardType): {
    routeHash: Hex
    rewardHash: Hex
    intentHash: Hex
  } {
    const routeHash = hashRoute(route)
    const rewardHash = hashReward(reward)
  
    console.log("hashIntent: ", destination, routeHash, rewardHash)
  
    const intentHash = keccak256(
      encodePacked(['uint64', 'bytes32', 'bytes32'], [destination, routeHash, rewardHash]),
    )
  
    return {
      routeHash,
      rewardHash,
      intentHash,
    }
  }

export function hashIntentSvm(destination: bigint, route: RouteType, reward: RewardType): {
    routeHash: Hex
    rewardHash: Hex
    intentHash: Hex
} {
    const routeHash = hashRoute(route)
    const rewardHash = hashReward(reward)


    // Match Rust: destination.to_be_bytes() (u64 as big-endian bytes)
    const destinationBytes = new Uint8Array(8);
    const view = new DataView(destinationBytes.buffer);
    view.setBigUint64(0, destination, false);

    // Match Rust: hasher.update(destination.to_be_bytes().as_slice());
    const routeHashBytes = new Uint8Array(Buffer.from(routeHash.slice(2), 'hex'));
    const rewardHashBytes = new Uint8Array(Buffer.from(rewardHash.slice(2), 'hex'));

    const combined = new Uint8Array(8 + 32 + 32);
    combined.set(destinationBytes, 0);
    combined.set(routeHashBytes, 8);
    combined.set(rewardHashBytes, 40);

    const intentHash = keccak256(`0x${Buffer.from(combined).toString('hex')}` as Hex);

    return {
    routeHash,
    rewardHash,
    intentHash,
    }
}