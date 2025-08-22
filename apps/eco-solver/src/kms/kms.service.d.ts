import { EcoConfigService } from '@libs/solver-config';
import { Signer } from '@eco-foundation/eco-kms-core';
import { KMSWallets } from '@eco-foundation/eco-kms-wallets';
import { OnModuleInit } from '@nestjs/common';
import { Hex } from 'viem';
/**
 * A service class that initializes the kms signer and provides for signing of messages.
 * @see {@link SignerKmsService}
 */
export declare class KmsService implements OnModuleInit {
    private readonly ecoConfigService;
    private logger;
    private keyID;
    wallets: KMSWallets;
    signer: Signer;
    constructor(ecoConfigService: EcoConfigService);
    onModuleInit(): Promise<void>;
    /**
     * Returns the address as hex of the KMS signer.
     * @returns the KMS eth address
     */
    getAddress(): Promise<Hex>;
    /**
     * Returns the KMS key ID that this service uses to sign
     * @returns the KMS key ID
     */
    getKmsKeyId(): string;
}
