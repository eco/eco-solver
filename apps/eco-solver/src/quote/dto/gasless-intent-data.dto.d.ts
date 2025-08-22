import { Hex } from 'viem';
import { PermitDataDTO } from '@eco-solver/quote/dto/permit-data.dto';
export declare class GaslessIntentDataDTO {
    funder: Hex;
    permitData?: PermitDataDTO;
    vaultAddress?: Hex;
    allowPartial: boolean;
    getPermitContractAddress?(): Hex;
}
