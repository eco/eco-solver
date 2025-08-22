import { Hex } from 'viem';
import { Permit2DTO } from '@eco-solver/quote/dto/permit2/permit2.dto';
import { PermitDTO } from '@eco-solver/quote/dto/permit/permit.dto';
import { PermitParams } from '@eco-solver/intent-initiation/permit-validation/interfaces/permit-params.interface';
export declare class PermitTestUtils {
    getRandomAddress(): Hex;
    getRandomHexString(len: number): string;
    createPermitParams(overrides?: Partial<PermitParams>): PermitParams;
    createPermitDTO(overrides?: Partial<PermitDTO>): PermitDTO;
    createPermit2DTO(overrides?: Partial<Permit2DTO>, opts?: {
        token?: Hex;
        isBatch?: boolean;
    }): Permit2DTO;
}
