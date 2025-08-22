import { SignerService } from './signer.service';
export declare class SignController {
    private readonly signer;
    private logger;
    constructor(signer: SignerService);
    fake(): Promise<void>;
    fakeSign(): Promise<void>;
}
