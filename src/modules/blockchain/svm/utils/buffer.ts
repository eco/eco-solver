import { Hex } from 'viem';

export const toBuffer = (hex: Hex) => Buffer.from(hex.slice(2), 'hex');
