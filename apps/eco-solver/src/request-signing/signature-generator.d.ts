import { LocalAccount } from 'viem';
import { SignatureHeaders } from '@eco-solver/request-signing/interfaces/signature-headers.interface';
import { SignedMessage } from '@eco-solver/request-signing/interfaces/signed-message.interface';
export declare class SignatureGenerator {
    signPayload(walletAccount: LocalAccount, payload: object, expiryTime: number): Promise<SignedMessage>;
    getHeadersWithWalletClient(walletAccount: LocalAccount, payload: object, expiryTime: number): Promise<SignatureHeaders>;
}
