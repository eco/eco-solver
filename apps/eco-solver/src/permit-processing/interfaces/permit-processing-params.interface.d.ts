import { Hex } from 'viem';
import { PermitDTO } from '@eco-solver/quote/dto/permit/permit.dto';
export interface PermitProcessingParams {
    chainID: number;
    permit: PermitDTO;
    owner: Hex;
    spender: Hex;
    value: bigint;
}
