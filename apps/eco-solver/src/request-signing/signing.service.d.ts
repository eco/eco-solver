import { OnModuleInit } from '@nestjs/common';
import { SignatureGenerator } from '@eco-solver/request-signing/signature-generator';
import { SignatureHeaders } from '@eco-solver/request-signing/interfaces/signature-headers.interface';
import { SignedMessage } from '@eco-solver/request-signing/interfaces/signed-message.interface';
import { ModuleRef } from '@nestjs/core';
export declare class SigningService implements OnModuleInit {
    private readonly signatureGenerator;
    private readonly moduleRef;
    private walletAccount;
    private walletClientDefaultSignerService;
    constructor(signatureGenerator: SignatureGenerator, moduleRef: ModuleRef);
    onModuleInit(): Promise<void>;
    getAccountAddress(): `0x${string}`;
    getHeaders(payload: object, expiryTime: number): Promise<SignatureHeaders>;
    signPayload(payload: object, expiryTime: number): Promise<SignedMessage>;
}
