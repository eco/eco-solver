import { IProverAbi } from '@eco-foundation/routes-ts';
import { ViemCall } from '../utils';
/**
 * Call type for the getProofType function
 */
export type ProofCall = ViemCall<typeof IProverAbi, 'pure'>;
