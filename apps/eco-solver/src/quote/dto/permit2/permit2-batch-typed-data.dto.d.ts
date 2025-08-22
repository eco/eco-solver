import { Hex } from 'viem';
import { Permit2TypedDataDetailsDTO } from '@eco-solver/quote/dto/permit2/permit2-typed-data-details.dto';
export declare class Permit2BatchTypedDataDTO {
    details: Permit2TypedDataDetailsDTO[];
    spender: Hex;
    sigDeadline: bigint;
}
