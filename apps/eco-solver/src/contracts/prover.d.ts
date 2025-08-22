import { Enumify } from 'enumify';
export declare class ProofType extends Enumify {
    private providerValue;
    static HYPERLANE: ProofType;
    static METALAYER: ProofType;
    static _: void;
    constructor(providerValue: string);
    private static providerValueToEnumMap;
    static initializeProofTypeMap(): void;
    static initialize(): void;
    static fromString(enumstr: string): ProofType;
    isHyperlane(): boolean;
    isMetalayer(): boolean;
    static fromProviderValue(providerValue: string): ProofType;
    getProviderValue(): string;
    toString(): string;
}
