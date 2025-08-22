import { CrossChainRoutesDTO } from '@eco-solver/solver-registration/dtos/cross-chain-routes.dto';
export declare class SolverRegistrationDTO {
    intentExecutionTypes: string[];
    crossChainRoutes: CrossChainRoutesDTO;
    supportsNativeTransfers?: boolean;
    quotesUrl: string;
    receiveSignedIntentUrl: string;
}
