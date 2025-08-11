import { ViemCall } from '../utils'
import { IProverAbi } from '@eco-foundation/routes-ts'

/**
 * Call type for the getProofType function
 */
export type ProofCall = ViemCall<typeof IProverAbi, 'pure'>
