import { Call } from '@eco-solver/intent-initiation/permit-validation/interfaces/call.interface';
import { EcoResponse } from '@eco-solver/common/eco-response';
import { PermitParams } from '@eco-solver/intent-initiation/permit-validation/interfaces/permit-params.interface';
import { PublicClient, Address, Signature } from 'viem';
import { Hex } from 'viem';
export declare class PermitValidator {
    private static logger;
    static validatePermits(client: PublicClient, permits: PermitParams[]): Promise<EcoResponse<void>>;
    static validatePermit(client: PublicClient, permit: PermitParams): Promise<EcoResponse<void>>;
    static validatePermitSignature(client: PublicClient, permit: PermitParams): Promise<EcoResponse<void>>;
    static getPermitCalls(permits: PermitParams[]): Call[];
    static parseSignature(signatureHex: Hex): Signature;
    static getPermitNonce(client: PublicClient, tokenAddress: Address, owner: Address): Promise<bigint>;
    static validateNonce(client: PublicClient, token: Address, owner: Address, expectedNonce: bigint): Promise<EcoResponse<void>>;
}
