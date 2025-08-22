import { EcoResponse } from '@eco-solver/common/eco-response';
import { Hex } from 'viem';
export declare class SignatureVerificationService {
    private readonly logger;
    verifySignature(payload: object, signature: Hex, expiryTime: string | number, claimedAddress: string): Promise<EcoResponse<string>>;
    private verifyTypedData;
}
