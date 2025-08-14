import { IProverAbi } from '@eco/foundation-eco-adapter'
import { ViemCall } from '../utils'

/**
 * Call type for the getProofType function
 */
export type ProofCall = ViemCall<typeof IProverAbi, 'pure'>
