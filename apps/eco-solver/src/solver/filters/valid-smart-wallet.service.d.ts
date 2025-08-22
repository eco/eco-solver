import { OnModuleInit } from '@nestjs/common';
import { MultichainPublicClientService } from '../../transaction/multichain-public-client.service';
import { EcoConfigService } from '@libs/solver-config';
import { Hex } from 'viem';
export declare class ValidSmartWalletService implements OnModuleInit {
    private readonly publicClient;
    private readonly ecoConfigService;
    private logger;
    private entryPointAddress;
    private factoryAddress;
    constructor(publicClient: MultichainPublicClientService, ecoConfigService: EcoConfigService);
    onModuleInit(): void;
    /**
     * Validates that the smart wallet account that posts and creates an IntentCreated event on chain
     * for the IntentSource contract, is from the correct smart wallet factory.
     *
     * @param smartWalletAddress the address of the smart wallet to validate
     * @param chainID the chain id of the transaction the event is from
     */
    validateSmartWallet(smartWalletAddress: Hex, chainID: bigint): Promise<boolean>;
}
