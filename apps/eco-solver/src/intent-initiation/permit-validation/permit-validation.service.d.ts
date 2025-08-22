import { EcoResponse } from '@eco-solver/common/eco-response';
import { Permit2Params } from '@eco-solver/intent-initiation/permit-validation/interfaces/permit2-params.interface';
import { PermitParams } from '@eco-solver/intent-initiation/permit-validation/interfaces/permit-params.interface';
import { PermitValidationArgs } from '@eco-solver/intent-initiation/permit-validation/interfaces/permit-validation-args.interface';
import { PublicClient } from 'viem';
import { ValidateVaultFundingArgs } from '@eco-solver/intent-initiation/permit-validation/interfaces/validate-vault-funding-args.interface';
import { WalletClientDefaultSignerService } from '@eco-solver/transaction/smart-wallets/wallet-client.service';
export declare class PermitValidationService {
    private readonly walletClientDefaultSignerService;
    private logger;
    constructor(walletClientDefaultSignerService: WalletClientDefaultSignerService);
    private getClient;
    validatePermits(validationArgs: PermitValidationArgs): Promise<EcoResponse<void>>;
    batchSimulatePermits(client: PublicClient, permits: PermitParams[], permit2s: Permit2Params[]): Promise<EcoResponse<void>>;
    validateVaultFunding(args: ValidateVaultFundingArgs): Promise<EcoResponse<void>>;
    private getPermitSimulationParams;
    private getPermit2SimulationParams;
    private isValidVaultAddress;
}
