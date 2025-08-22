import { Call } from '@eco-solver/intent-initiation/permit-validation/interfaces/call.interface';
import { EcoResponse } from '@eco-solver/common/eco-response';
import { Permit2Params } from '@eco-solver/intent-initiation/permit-validation/interfaces/permit2-params.interface';
import { PublicClient } from 'viem';
export declare class Permit2Validator {
    private static logger;
    static validatePermits(client: PublicClient, chainId: number, permits: Permit2Params[]): Promise<EcoResponse<void>>;
    static validatePermit(client: PublicClient, chainId: number, permit: Permit2Params): Promise<EcoResponse<void>>;
    static validatePermitAddress(permit: Permit2Params): EcoResponse<void>;
    static validatePermitSignature(chainId: number, permit: Permit2Params): Promise<EcoResponse<void>>;
    static validateNonces(client: PublicClient, permit: Permit2Params): Promise<EcoResponse<void>>;
    static expirationCheck(expiration: number | bigint, logMessage: string): EcoResponse<void>;
    static getPermitCalls(permits: Permit2Params[]): Call[];
}
