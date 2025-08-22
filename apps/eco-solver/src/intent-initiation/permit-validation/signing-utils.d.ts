import { PublicClient, Address } from 'viem';
export interface Eip712Domain {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
}
export declare function getEip712DomainFromToken(client: PublicClient, tokenAddress: Address): Promise<Eip712Domain>;
