import { Hex } from 'viem';
import { Permit2DataDTO } from '@eco-solver/quote/dto/permit2/permit2-data.dto';
export declare class Permit2DTO {
    permitContract: Hex;
    permitData: Permit2DataDTO;
    signature: Hex;
}
