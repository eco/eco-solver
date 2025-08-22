import { EcoConfigService } from '@libs/solver-config';
import { NonceService } from './nonce.service';
import { SignerService } from './signer.service';
import { PrivateKeyAccount } from 'viem';
import { Hex } from 'viem';
export declare class AtomicSignerService extends SignerService {
    readonly nonceService: NonceService;
    readonly ecoConfigService: EcoConfigService;
    constructor(nonceService: NonceService, ecoConfigService: EcoConfigService);
    protected buildAccount(): PrivateKeyAccount;
    protected getPrivateKey(): Hex;
}
