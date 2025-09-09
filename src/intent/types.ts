import { PublicKey, PublicKey as SvmAddress } from "@solana/web3.js"
import { decodeAbiParameters, encodeAbiParameters, encodePacked, Address as EvmAddress, Hex, keccak256 } from "viem"
import { RewardStruct, RouteStruct } from "./abi"
import { BN, BorshCoder, Idl } from "@coral-xyz/anchor"

const portalIdl = require('src/solana/program/portal.json');
const svmCoder = new BorshCoder(portalIdl as Idl);

export enum VmType {
    EVM = 'EVM',
    SVM = 'SVM'
  }

export type Address<TVM extends VmType = VmType> = TVM extends VmType.EVM ? EvmAddress : SvmAddress

export type SerializableAddress<TVM extends VmType = VmType> = TVM extends VmType.EVM ? EvmAddress : string
  
// Mapping of chainId to VM type
export const CHAIN_VM_TYPE_MAP: Record<number, VmType> = {
    // Optimism
    10: VmType.EVM,
    // Solana Mainnet
    1399811149: VmType.SVM,
} as const
  
export function getVmType(chainId: number): VmType {
    return CHAIN_VM_TYPE_MAP[chainId]
}


export type V2RouteType<TVM extends VmType = VmType> = {
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


export type V2RewardType<TVM extends VmType = VmType> = {
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

export type V2IntentType<SourceVM extends VmType = VmType, DestinationVM extends VmType = VmType> = {
    destination: bigint
    source: bigint
    route: V2RouteType<DestinationVM>
    reward: V2RewardType<SourceVM>
}

export function decodeRoute(vm: VmType, route: Hex): V2RouteType {
    switch (vm) {
        case VmType.EVM:
            console.log("SAQUON decodeRoute EVM", route);
            return {
            vm: VmType.EVM,
            ...decodeAbiParameters(
                [{ type: 'tuple', components: RouteStruct }],
                route, 
            )[0]
            } as V2RouteType
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

export function encodeReward(reward: V2RewardType): Hex {
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

export function hashReward(reward: V2RewardType): Hex {
    return keccak256(encodeReward(reward))
}

export function encodeRoute(route: V2RouteType): Hex {
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

export function hashRoute(route: V2RouteType): Hex {
    return keccak256(encodeRoute(route))
}

export function hashIntent(destination: bigint, route: V2RouteType, reward: V2RewardType): {
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
  