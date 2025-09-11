import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type NonPrimitive = PublicKey | Buffer | BN;

type CamelToSnake<S extends string> = S extends `${infer H}${infer T}`
  ? T extends Uncapitalize<T>
    ? `${Lowercase<H>}${CamelToSnake<T>}` // next is lowercase → no underscore
    : `${Lowercase<H>}_${CamelToSnake<Uncapitalize<T>>}` // next starts uppercase → insert "_"
  : S;

export type Snakify<T> = T extends Primitive | NonPrimitive
  ? T
  : T extends Array<infer U>
    ? Array<Snakify<U>>
    : T extends ReadonlyArray<infer U>
      ? ReadonlyArray<Snakify<U>>
      : T extends object
        ? { [K in keyof T as K extends string ? CamelToSnake<K> : K]: Snakify<T[K]> }
        : T;
