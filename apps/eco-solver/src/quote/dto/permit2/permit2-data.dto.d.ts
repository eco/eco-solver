import { BatchPermitDataDTO } from '@eco-solver/quote/dto/permit2/batch-permit-data.dto';
import { Hex } from 'viem';
import { Permit2TypedDataDetailsDTO } from '@eco-solver/quote/dto/permit2/permit2-typed-data-details.dto';
import { SinglePermitDataDTO } from '@eco-solver/quote/dto/permit2/single-permit-data.dto';
export declare class Permit2DataDTO {
    singlePermitData?: SinglePermitDataDTO;
    batchPermitData?: BatchPermitDataDTO;
    getDetails(): Permit2TypedDataDetailsDTO[];
    getSpender(): Hex;
    getSigDeadline(): bigint;
}
