import { Enumify } from 'enumify';
export declare class PermitType extends Enumify {
    static PERMIT: PermitType;
    static PERMIT2: PermitType;
    static _: void;
    static fromString(enumstr: string): PermitType | undefined;
    isPermit(): boolean;
    isPermit2(): boolean;
    toString(): string;
}
