import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { keccak256, toHex, hexToBigInt, toBytes } from "viem";

/**
 * Deterministically serializes an object into a JSON string
 */
export function serializeObject(obj: object): string {
    return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * Hashes an object using keccak256
 */
export function hashObject(obj: object): `0x${string}` {
    const json = serializeObject(obj);
    const hash = keccak256(toBytes(json));
    return hash;
}

