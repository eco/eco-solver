import { Hex } from 'viem';
import { Permit2DTO } from '@eco-solver/quote/dto/permit2/permit2.dto';
import { PermitDTO } from '@eco-solver/quote/dto/permit/permit.dto';
export declare class PermitDataDTO {
    permit?: PermitDTO[];
    permit2?: Permit2DTO;
    getPermitContractAddress?(): Hex;
}
