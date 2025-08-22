import { Hex } from 'viem';
import { PermitSignatureDTO } from '@eco-solver/quote/dto/permit/permit-signature-data.dto';
export declare class PermitDTO {
    token: Hex;
    data: PermitSignatureDTO;
}
