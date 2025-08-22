import { EcoResponse } from '@eco-solver/common/eco-response';
import { ValidateVaultFundingArgs } from '@eco-solver/intent-initiation/permit-validation/interfaces/validate-vault-funding-args.interface';
export declare enum VaultStatus {
    EMPTY = 0,
    PARTIALLY_FUNDED = 1,
    FULLY_FUNDED = 2,
    CLAIMED = 3,
    Refunded = 4
}
export declare class VaultFundingValidator {
    private static logger;
    static validateVaultFunding(args: ValidateVaultFundingArgs): Promise<EcoResponse<void>>;
    static isVaultFunded(args: ValidateVaultFundingArgs): Promise<boolean>;
    static isVaultStale(status: VaultStatus): boolean;
    static getVaultStatus(args: ValidateVaultFundingArgs): Promise<VaultStatus>;
}
