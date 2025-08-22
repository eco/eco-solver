import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Model } from 'mongoose';
import { Nonce } from './schemas/nonce.schema';
import { Queue } from 'bullmq';
import { EcoConfigService } from '@libs/solver-config';
import { AtomicKeyClientParams, AtomicNonceService } from './atomic.nonce.service';
import { SignerService } from './signer.service';
/**
 * TODO this class needs to be assigned to an EAO, a userOp gets its nonce throught the alchemy sdk
 * which pulls its fromt the rpc bundler
 */
export declare class NonceService extends AtomicNonceService<Nonce> implements OnApplicationBootstrap {
    private nonceModel;
    private readonly signerQueue;
    private readonly signerService;
    private readonly ecoConfigService;
    protected logger: Logger;
    private intentJobConfig;
    constructor(nonceModel: Model<Nonce>, signerQueue: Queue, signerService: SignerService, ecoConfigService: EcoConfigService);
    onApplicationBootstrap(): Promise<void>;
    syncQueue(): Promise<void>;
    protected getSyncParams(): Promise<AtomicKeyClientParams[]>;
    getLastSynceAt(): Promise<Date>;
    shouldSync(): Promise<{
        should: boolean;
        hash: string;
    }>;
}
